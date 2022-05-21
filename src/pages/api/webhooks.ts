import { NextApiRequest, NextApiResponse } from "next";
import { Readable } from 'stream';
import  Stripe  from "stripe";
import { stripe } from "../../services/stripe";
import { saveSubscription } from "./_lib/manageSubscription";

//Function for prepare string and to be read
async function buffer(readable: Readable) {
    const chunks = [];

    for await (const chunk of readable) {
        chunks.push(
            typeof chunk === "string" ? Buffer.from(chunk) : chunk
        );
    }
    return Buffer.concat(chunks);
}

//Set type of return to no json
export const config = {
    api: {
        bodyParser: false,
    }
}

//Array of relevantEvents without duplicated itens
const relevantEvents = new Set([
    'checkout.session.completed'
]);

export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "POST") {
        const buf = await buffer(req);
        const secret = req.headers['stripe-signature']

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(buf, secret, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (error) {
            return res.status(400).send(`Webhook error: ${error.message}`);
        }

        const { type } = event;

        if (relevantEvents.has(type)) {
            try {
                switch (type) {
                    case 'checkout.session.completed':

                        const checkoutSession = event.data.object as Stripe.Checkout.Session

                        await saveSubscription(
                            checkoutSession.subscription.toString(),
                            checkoutSession.customer.toString()
                        )

                        break;
                    default:
                        throw new Error('Unhandled event.')
                }
                console.log('Evento recebido', type);    
            } catch (err) {
                res.json({ error: 'Webook handler ffailed' })
            }
            
        }


        res.json({ received: true })
    } else {
        res.setHeader('Allow', 'POST'); //Informa tipo permitido
        res.status(485).end('Method not allowed');
    }
}