import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event;
  try {
    const stripe = (await import('stripe')).default;
    const stripeClient = new stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripeClient.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature error:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as { client_reference_id: string; customer: string; subscription: string };
      await supabase.from('subscriptions').upsert({
        user_id: session.client_reference_id,
        stripe_customer_id: session.customer,
        stripe_sub_id: session.subscription,
        status: 'active',
        plan: 'monthly',
      }, { onConflict: 'user_id' });
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      const status = sub.status === 'active' ? 'active' : 'canceled';
      // Stripe moved current_period_end onto the subscription items in recent API versions
      const periodEnd = sub.items.data[0]?.current_period_end;
      await supabase
        .from('subscriptions')
        .update({
          status,
          period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        })
        .eq('stripe_sub_id', sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
