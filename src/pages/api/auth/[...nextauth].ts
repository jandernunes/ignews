import { query as q } from 'faunadb'
import NextAuth from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import { fauna } from '../../../services/fauna'

export default NextAuth({
  // Configure one or more authentication providers
  providers: [

    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      authorization: {
        params: {
          scope: 'read:user',
        },
      },
    }),
    // ...add more providers here
  ],
  
  // jwt: {
  //   signingKey: process.env.SIGNING_KEY,
  // },

  callbacks: {
    async signIn({ user, account, profile, credentials }) {
      const { email } = user;


      console.log(user, email);
      try {
        await fauna.query( 
         q.If(
           q.Not(
             q.Exists( //If not exist usuário com esse email. Busca sempre pelo índice
               q.Match(
                 q.Index('user_by_email'),
                 q.Casefold(user.email)
               )
             )
           ),
           q.Create( //Se não existe então adiciona. Query para criação de registro armazenando o email
            q.Collection('users'),
            { data: { email } }
            ),
            q.Get(// Se já existe então apenas busca
              q.Match(
                q.Index('user_by_email'),
                q.Casefold(user.email)
              )
            )
         )
        )
        return true

      } catch (error) {
        return false
      }
    },
  }
})