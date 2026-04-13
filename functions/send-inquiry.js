// Cloudflare Pages Function — handles inquiry form submissions
// Endpoint: POST /send-inquiry
// Environment variables required:
//   RESEND_API_KEY   — your Resend API key
//   TURNSTILE_SECRET — your Cloudflare Turnstile secret key
//   ADMIN_EMAIL      — gets BCC on every inquiry (info@21webstudios.com)

export async function onRequest(context) {
  const { request, env } = context;

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid request body' }), { status: 400, headers: corsHeaders });
  }

  const { unitNum, firstName, email, phone, checkin, checkout, message, turnstileToken, isListInquiry } = body;

  // ── Validate required fields ──
  if (!firstName || !email) {
    return new Response(JSON.stringify({ success: false, error: 'Missing required fields' }), { status: 400, headers: corsHeaders });
  }

  // ── Verify Turnstile token ──
  const turnstileRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret: env.TURNSTILE_SECRET,
      response: turnstileToken
    })
  });
  const turnstileData = await turnstileRes.json();
  if (!turnstileData.success) {
    return new Response(JSON.stringify({ success: false, error: 'Spam check failed. Please try again.' }), { status: 400, headers: corsHeaders });
  }

  // ── Shared email building blocks ──
  const phoneRow = phone
    ? `<tr><td style="padding:8px 0;color:#717171;font-size:13px;border-bottom:1px solid #f0f0f0">Phone</td><td style="padding:8px 0;font-weight:600;color:#222;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right">${phone}</td></tr>`
    : '';

  const headerBlock = `
    <tr><td style="background:#1a5276;padding:24px 32px;text-align:center">
      <div style="font-family:Georgia,serif;font-size:32px;font-style:italic;color:#fff;letter-spacing:2px">1480</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.7);letter-spacing:4px;margin-top:4px">SOUTH OCEAN.COM</div>
    </td></tr>`;

  const footerBlock = `
    <tr><td style="background:#f7f7f7;border-top:1px solid #ebebeb;padding:20px 32px;text-align:center">
      <p style="margin:0;font-size:11px;color:#bbb;line-height:1.6">Submitted via <a href="https://1480southocean.com" style="color:#1D9E75">1480SouthOcean.com</a>. Reply directly to <a href="mailto:${email}" style="color:#1D9E75">${email}</a>.</p>
    </td></tr>`;

  let html, subject, toEmail;

  // ── LIST YOUR UNIT path ──
  if (isListInquiry) {
    toEmail = env.ADMIN_EMAIL;
    subject = `New listing inquiry — Unit ${unitNum}`;
    html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ebebeb;max-width:560px;width:100%">
        ${headerBlock}
        <tr><td style="padding:32px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#9a6f00;margin-bottom:8px">New Listing Inquiry</div>
          <h2 style="margin:0 0 6px;font-size:20px;color:#222">Unit ${unitNum} wants to be listed</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#717171">Someone submitted the "List your unit" form.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0">
            <tr><td style="padding:8px 0;color:#717171;font-size:13px;border-bottom:1px solid #f0f0f0">Name</td><td style="padding:8px 0;font-weight:600;color:#222;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right">${firstName}</td></tr>
            <tr><td style="padding:8px 0;color:#717171;font-size:13px;border-bottom:1px solid #f0f0f0">Email</td><td style="padding:8px 0;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right"><a href="mailto:${email}" style="color:#1D9E75;font-weight:600">${email}</a></td></tr>
            ${phoneRow}
            <tr><td style="padding:8px 0;color:#717171;font-size:13px;border-bottom:1px solid #f0f0f0">Unit</td><td style="padding:8px 0;font-weight:600;color:#222;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right">${unitNum}</td></tr>
          </table>
          ${message ? `
          <div style="margin-top:24px;background:#f7f7f7;border-radius:10px;padding:16px 20px">
            <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Message</div>
            <p style="margin:0;font-size:14px;color:#484848;line-height:1.7">${message.replace(/\n/g, '<br/>')}</p>
          </div>` : ''}
          <div style="margin-top:28px;text-align:center">
            <a href="mailto:${email}" style="display:inline-block;background:#1D9E75;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none">Reply to ${firstName}</a>
          </div>
        </td></tr>
        ${footerBlock}
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── UNIT INQUIRY path ──
  } else {
    if (!unitNum) {
      return new Response(JSON.stringify({ success: false, error: 'Missing unit number' }), { status: 400, headers: corsHeaders });
    }

    // Load units.json to find owner email and direct flag
    let units = [];
    try {
      const unitsRes = await fetch(new URL('/data/units.json', request.url));
      const unitsData = await unitsRes.json();
      units = unitsData.units;
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Could not load unit data' }), { status: 500, headers: corsHeaders });
    }

    const unit = units.find(u => u.n === parseInt(unitNum));
    if (!unit) {
      return new Response(JSON.stringify({ success: false, error: 'Unit not found' }), { status: 404, headers: corsHeaders });
    }

    // Route to owner if direct:true and em is set, otherwise to admin
    toEmail = (unit.direct && unit.em) ? unit.em : env.ADMIN_EMAIL;
    subject = `New inquiry — Unit ${unit.n} · ${unit.title}`;

    const dateRow = (checkin && checkout)
      ? `<tr><td style="padding:8px 0;color:#717171;font-size:13px;border-bottom:1px solid #f0f0f0">Dates</td><td style="padding:8px 0;font-weight:600;color:#222;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right">${checkin} → ${checkout}</td></tr>`
      : '';

    html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ebebeb;max-width:560px;width:100%">
        ${headerBlock}
        <tr><td style="padding:32px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#1D9E75;margin-bottom:8px">New Inquiry</div>
          <h2 style="margin:0 0 6px;font-size:20px;color:#222">Unit ${unit.n} · Floor ${unit.fl}</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#717171">${unit.title}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f0f0">
            <tr><td style="padding:8px 0;color:#717171;font-size:13px;border-bottom:1px solid #f0f0f0">From</td><td style="padding:8px 0;font-weight:600;color:#222;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right">${firstName}</td></tr>
            <tr><td style="padding:8px 0;color:#717171;font-size:13px;border-bottom:1px solid #f0f0f0">Email</td><td style="padding:8px 0;font-size:13px;border-bottom:1px solid #f0f0f0;text-align:right"><a href="mailto:${email}" style="color:#1D9E75;font-weight:600">${email}</a></td></tr>
            ${phoneRow}
            ${dateRow}
          </table>
          ${message ? `
          <div style="margin-top:24px;background:#f7f7f7;border-radius:10px;padding:16px 20px">
            <div style="font-size:11px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Message</div>
            <p style="margin:0;font-size:14px;color:#484848;line-height:1.7">${message.replace(/\n/g, '<br/>')}</p>
          </div>` : ''}
          <div style="margin-top:28px;text-align:center">
            <a href="mailto:${email}" style="display:inline-block;background:#1D9E75;color:#fff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none">Reply to ${firstName}</a>
          </div>
        </td></tr>
        ${footerBlock}
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  // ── Send via Resend ──
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'noreply@1480southocean.com',
      to: toEmail,
      bcc: env.ADMIN_EMAIL,
      subject: subject,
      html: html,
      reply_to: email
    })
  });

  const resendData = await resendRes.json();

  if (!resendRes.ok) {
    console.error('Resend error:', resendData);
    return new Response(JSON.stringify({ success: false, error: 'Failed to send email' }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
}
