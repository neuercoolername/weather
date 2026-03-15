import { Resend } from 'resend';

const resend = new Resend(`${process.env.RESEND_API_KEY}`);

async function main() {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: process.env.NOTIFICATION_EMAIL!,
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
  });

  console.log('Resend response:', data, error);
}

main();