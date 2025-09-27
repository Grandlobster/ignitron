const Razorpay = require("razorpay");
const { Client } = require("pg");
const crypto = require("crypto");

exports.handler = async (event, context) => {
  let client;
  try {
    const body = JSON.parse(event.body);
    const {
      name,
      college,
      year,
      email,
      phone,
      event: event_type,
      gender,
      pronouns,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!razorpay_signature) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: "Missing signature" }) };
    }

    // 1️⃣ Verify signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: "Invalid signature" }) };
    }

    // 2️⃣ Connect to DB
    client = new Client({ connectionString: process.env.NETLIFY_DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // 3️⃣ Insert registration
    const insertQuery = `
      INSERT INTO registrations
        (name, college, year, email, phone, event_type, gender, pronouns, razorpay_order_id, razorpay_payment_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id
    `;
    const values = [name, college, year, email, phone, event_type, gender, pronouns, razorpay_order_id, razorpay_payment_id];

    const result = await client.query(insertQuery, values);

    await client.end();

    return { statusCode: 200, body: JSON.stringify({ success: true, registrationId: result.rows[0].id }) };

  } catch (error) {
    if (client) await client.end();
    console.error("Error in verify-payment:", error);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: "Payment verification failed" }) };
  }
};
