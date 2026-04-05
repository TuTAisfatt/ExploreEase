const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const gmailEmail    = functions.config().gmail.email;
const gmailPassword = functions.config().gmail.password;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

exports.sendOTPEmail = functions.https.onCall(async (data, context) => {
  const { email, otp, name } = data;
  if (!email || !otp) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email and OTP are required.'
    );
  }
  const mailOptions = {
    from:    `ExploreEase <${gmailEmail}>`,
    to:      email,
    subject: 'Your ExploreEase verification code',
    html: `<p>Hi ${name ?? 'Explorer'}, your code is: <strong>${otp}</strong>. Expires in 10 minutes.</p>`,
  };
  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send email.');
  }
});