import { NmiPayments } from '@nmipayments/nmi-pay-react';
import { useState } from 'react';

export default function PaymentForm() {
  const [amount, setAmount] = useState('10.99');
  const [paymentStatus, setPaymentStatus] = useState('');

  return (
    <div>
      <div className="form-row">
        <label htmlFor="amount">Amount:</label>
        <input
          id="amount"
          type="text"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      {paymentStatus && (
        <div className={paymentStatus === 'Payment successful!' ? 'success' : 'error'}>
          {paymentStatus}
        </div>
      )}

      <NmiPayments
        tokenizationKey={import.meta.env.VITE_NMI_TOKENIZATION_KEY}
        onPay={async (token) => {
          try {
            const response = await fetch('/api/process-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                paymentToken: token,
                amount: parseFloat(amount),
              }),
            });

            const data = await response.json();

            if (data.success) {
              setPaymentStatus('Payment successful!');
              return true;
            }

            const errorMessage = data.error || 'Payment failed';
            setPaymentStatus(errorMessage);
            return errorMessage;
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setPaymentStatus(errorMessage);
            return errorMessage;
          }
        }}
      />
    </div>
  );
}