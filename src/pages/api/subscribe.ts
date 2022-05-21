import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/react";
import { query as q } from 'faunadb'
import { fauna } from "../../services/fauna";
import { stripe } from "../../services/stripe";

type User = {
    ref: {
        id: string
    }
    data: { 
        stripe_customer_id: string
    }
} 


export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "POST") {
        const session = await getSession({req}); //Recupera sessão do usuário do front

        //Query user
        const user = await fauna.query<User>(
            q.Get(
                q.Match(
                    q.Index('user_by_email'),
                    q.Casefold(session.user.email)
                )
            )
            
        )
        
        //Get stripe_customer_id
        let customerId = user.data.stripe_customer_id

        if (!customerId)//Se não tem customer então cria no Stripe e atualiza campo no banco
        {
            const stripeCustomer = await stripe.customers.create({ //Criando cliente no stripe
                email: session.user.email
            });
    
            //Atualiza stripe ID no usuário no banco
            await fauna.query(
                q.Update(
                    q.Ref(q.Collection('users'), user.ref.id),
                    {
                        data: {
                            stripe_customer_id: stripeCustomer.id,
                        }
                    }
                )
            )

            customerId = stripeCustomer.id
    
        }
        
        
        const stripeCheckoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            billing_address_collection: 'required',
            line_items: [
                {price: 'price_1KzWSuLU3cZUJtFfe960p2P7', quantity: 1}
            ],
            mode: 'subscription',
            allow_promotion_codes: true,
            success_url: process.env.STRIPE_SUCESS_URL,
            cancel_url: process.env.STRIPE_CANCEL_URL
        }) 

        return res.status(200).json({sessionId: stripeCheckoutSession.id})
    } else {
        res.setHeader('Allow', 'POST'); //Informa tipo permitido
        res.status(485).end('Method not allowed');
    }
}