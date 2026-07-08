import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import PlaidConnectButton from "./components/PlaidConnectButton";

export default function InvestorWallet() {
  const [investments, setInvestments] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWallet();
  }, []);

  function money(value: any) {
    return "$" + Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  function formatDate(value: string) {
    if (!value) return "—";
    return new Date(value).toLocaleDateString();
  }

  function accountLabel(account: any) {
    const bank = account.bank_name || account.institution_name || "Bank Account";
    const name = account.account_name || account.account_subtype || "Account";
    const mask = account.account_mask || account.account_number?.slice(-4) || "";
    return `${bank} ${name}${mask ? " ••••" + mask : ""}`;
  }

  async function getSessionToken() {
    if (!supabase) return null;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.access_token || null;
  }

  async function loadBankAccounts(token: string) {
    const response = await fetch("/api/bank-accounts", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();

    if (response.ok) {
      setBankAccounts(result.accounts || []);
    }
  }

  async function loadWallet() {
    if (!supabase) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const token = await getSessionToken();
    if (token) await loadBankAccounts(token);

    let { data: walletData } = await supabase
      .from("investor_wallets")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!walletData) {
      const { data: newWallet, error } = await supabase
        .from("investor_wallets")
        .insert({ user_id: user.id })
        .select()
        .single();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      walletData = newWallet;
    }

    setWallet(walletData);

    const { data: investmentData, error: investmentError } = await supabase
      .from("investments")
      .select("*")
      .eq("investor_id", user.id)
      .order("created_at", { ascending: false });

    if (investmentError) {
      alert(investmentError.message);
      setLoading(false);
      return;
    }

    setInvestments(investmentData || []);

    const { data: transactionData } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setTransactions(transactionData || []);
    setLoading(false);
  }

  async function chooseBankAccount() {
    if (bankAccounts.length === 0) {
      alert("Connect a bank account first.");
      return null;
    }

    if (bankAccounts.length === 1) {
      return bankAccounts[0];
    }

    const list = bankAccounts
      .map((account, index) => `${index + 1}. ${accountLabel(account)}`)
      .join("\n");

    const choice = prompt(`Choose bank account:\n\n${list}`);

    if (!choice) return null;

    const index = Number(choice) - 1;
    const account = bankAccounts[index];

    if (!account) {
      alert("Invalid bank account selection.");
      return null;
    }

    return account;
  }

  async function handleDeposit() {
    const account = await chooseBankAccount();
    if (!account) return;

    const amount = prompt(`Deposit from:\n${accountLabel(account)}\n\nEnter deposit amount:`);

    if (!amount) return;

    const depositAmount = Number(amount);

    if (!depositAmount || depositAmount < 1) {
      alert("Enter a valid deposit amount.");