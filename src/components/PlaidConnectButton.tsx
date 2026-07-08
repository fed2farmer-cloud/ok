import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

export default function PlaidConnectButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    async function createLinkToken() {
      const response = await fetch("/api/create-link-token");
      const data = await response.json();

      if (data.link_token) {
        setLinkToken(data.link_token);
      } else {
        alert("Plaid link token error: " + JSON.stringify(data.error));
      }
    }

    createLinkToken();
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      const response = await fetch("/api/exchange-public-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ public_token }),
      });

      const data = await response.json();

      if (data.access_token) {
        alert("Bank account connected successfully.");
      } else {
        alert("Plaid exchange failed: " + JSON.stringify(data.error));
      }
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="bg-green-600 text-white px-5 py-3 rounded-lg font-bold"
    >
      Connect Bank Account
    </button>
  );
}