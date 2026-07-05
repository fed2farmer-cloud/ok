import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function LoanDocuments() {
  const [loanId, setLoanId] = useState("");
  const [documentType, setDocumentType] = useState("deed");
  const [file, setFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data, error } = await supabase
      .from("loan_documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setDocuments(data || []);
  }

  async function uploadDocument(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!supabase) return;

    if (!loanId) {
      alert("Enter the loan application ID.");
      return;
    }

    if (!file) {
      alert("Choose a file to upload.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${loanId}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("loan-documents")
      .upload(filePath, file);

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const { data: signedUrlData } = await supabase.storage
      .from("loan-documents")
      .createSignedUrl(filePath, 60 * 60);

    const { error: insertError } = await supabase.from("loan_documents").insert({
      loan_application_id: Number(loanId),
      user_id: user.id,
      document_type: documentType,
      file_name: file.name,
      file_url: signedUrlData?.signedUrl || filePath,
    });

    if (insertError) {
      alert(insertError.message);
      return;
    }

    setMessage("Document uploaded successfully.");
    setFile(null);
    await loadDocuments();
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
        <h1 className="text-3xl font-bold text-green-700">
          Upload Loan Documents
        </h1>

        <p className="mt-2 text-gray-600">
          Upload supporting documents for your land-backed loan application.
        </p>

        <form onSubmit={uploadDocument} className="mt-6 space-y-4">
          <input
            type="number"
            placeholder="Loan Application ID"
            value={loanId}
            onChange={(e) => setLoanId(e.target.value)}
            className="w-full border p-3 rounded"
          />

          <select
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value)}
            className="w-full border p-3 rounded"
          >
            <option value="government_id">Government ID</option>
            <option value="deed">Land Deed / Title</option>
            <option value="tax_bill">Property Tax Bill</option>
            <option value="survey">Property Survey</option>
            <option value="appraisal">Appraisal</option>
            <option value="bank_statement">Bank Statement</option>
            <option value="tax_return">Tax Return</option>
            <option value="proof_of_income">Proof of Income</option>
            <option value="llc_documents">LLC Documents</option>
            <option value="other">Other</option>
          </select>

          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full border p-3 rounded"
          />

          <button className="w-full bg-green-600 text-white py-3 rounded-lg font-bold">
            Upload Document
          </button>
        </form>

        {message && <p className="mt-4 text-green-700 font-bold">{message}</p>}

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Uploaded Documents</h2>

          {documents.length === 0 ? (
            <p>No documents uploaded yet.</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="border rounded p-4 mb-3">
                <p><strong>Loan ID:</strong> {doc.loan_application_id}</p>
                <p><strong>Type:</strong> {doc.document_type}</p>
                <p><strong>File:</strong> {doc.file_name}</p>
                <a href={doc.file_url} target="_blank" className="text-blue-600 underline">
                  View Document
                </a>
              </div>
           