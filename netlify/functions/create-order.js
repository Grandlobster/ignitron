// netlify/functions/create-order.js
const Razorpay = require("razorpay");
const { Client } = require("pg");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = Object.fromEntries(new URLSearchParams(event.body));

    // Connect to Postgres (Neon)
    const client = new Client({ connectionString: process.env.NETLIFY_DATABASE_URL });
    await client.connect();

    // Insert registration without Razorpay ID first
    const insertQuery = `
      INSERT INTO registrations (name, college, phone, email, year, event_type, pronouns)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id
    `;
    const values = [
      data.name,
      data.college,
      data.phone,
      data.email,
      data.year,
      data.event,
      data.pronouns,
    ];
    const result = await client.query(insertQuery, values);
    const registrationId = result.rows[0].id;

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: 1000, // ₹10
      currency: "INR",
      receipt: `reg_${registrationId}`,
      payment_capture: 1,
    });

    // Update registration with Razorpay order ID
    await client.query(
      "UPDATE registrations SET razorpay_order_id = $1 WHERE id = $2",
      [order.id, registrationId]
    );

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({ orderId: order.id }),
    };
  } catch (err) {
    console.error("Error in create-order:", err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
