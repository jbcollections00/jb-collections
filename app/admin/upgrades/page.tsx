"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AdminHeader from "@/app/components/AdminHeader"
import { createClient } from "@/lib/supabase/client"

type UpgradeRequest = {
  id: string
  sender_id: string | null
  name: string | null
  email: string | null
  plan: string | null
  subject: string | null
  body: string | null
  status: string | null
  admin_reply: string | null
  receipt_url?: string | null
  receipt_path?: string | null
  created_at: string
}

type FilterType = "all" | "pending" | "approved" | "rejected"

export default function UpgradesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [requests, setRequests] = useState<UpgradeRequest[]>([])
  const [selectedRequest, setSelectedRequest] = useState<UpgradeRequest | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")
  const [loading, setLoading] = useState(true)

  const [replyBody, setReplyBody] = useState("")
  const [savingReply, setSavingReply] = useState(false)

  const [isEditingRequest, setIsEditingRequest] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPlan, setEditPlan] = useState("")
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")
  const [savingRequestEdit, setSavingRequestEdit] = useState(false)

  const [isEditingReply, setIsEditingReply] = useState(false)
  const [editReplyText, setEditReplyText] = useState("")
  const [savingReplyEdit, setSavingReplyEdit] = useState(false)

  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deletingRequest, setDeletingRequest] = useState(false)

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    async function init() {
      const ok = await checkAdmin()
      if (!ok) return

      await loadRequests(true)

      interval = setInterval(() => {
        loadRequests(false)
      }, 5000)
    }

    init()

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!selectedRequest) {
      setReplyBody("")
      setIsEditingRequest(false)
      setIsEditingReply(false)
      return
    }

    setEditName(selectedRequest.name || "")
    setEditEmail(selectedRequest.email || "")
    setEditPlan(selectedRequest.plan || "premium")
    setEditSubject(selectedRequest.subject || "")
    setEditBody(selectedRequest.body || "")
    setReplyBody("")
    setEditReplyText(selectedRequest.admin_reply || "")
    setIsEditingRequest(false)
    setIsEditingReply(false)
  }, [selectedRequest])

  async function checkAdmin() {
    try {
      setCheckingAdmin(true)

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        router.replace("/secure-admin-portal-7X9")
        return false
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileError || profile?.role !== "admin") {
        router.replace("/secure-admin-portal-7X9")
        return false
      }

      return true
    } catch (error) {
      console.error("Admin upgrades auth check failed:", error)
      router.replace("/secure-admin-portal-7X9")
      return false
    } finally {
      setCheckingAdmin(false)
    }
  }

  async function loadRequests(showLoader = false) {
    if (showLoader) setLoading(true)

    const { data, error } = await supabase
      .from("upgrades")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Load upgrades error:", error)
      if (showLoader) setLoading(false)
      return
    }

    const nextRequests = (data as UpgradeRequest[]) || []
    setRequests(nextRequests)

    setSelectedRequest((current) => {
      if (!current) return nextRequests[0] || null
      const updated = nextRequests.find((req) => req.id === current.id)
      return updated || nextRequests[0] || null
    })

    if (showLoader) setLoading(false)
  }

  async function setPending(id: string) {
    try {
      setUpdatingStatus(true)

      const { error } = await supabase
        .from("upgrades")
        .update({ status: "pending" })
        .eq("id", id)

      if (error) {
        console.error("Set pending error:", error)
        alert(`Update failed: ${error.message}`)
        return
      }

      await loadRequests(false)
      alert("Request set to pending.")
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function approveRequest(request: UpgradeRequest) {
    if (!request.sender_id) {
      alert("This request has no sender_id, so it cannot be approved.")
      return
    }

    try {
      setUpdatingStatus(true)

      const response = await fetch("/api/admin/upgrades/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          upgradeId: request.id,
          userId: request.sender_id,
        }),
      })

      const text = await response.text()
      let result: { error?: string; success?: boolean } = {}

      try {
        result = text ? JSON.parse(text) : {}
      } catch {
        result = { error: text || "Invalid server response" }
      }

      if (!response.ok) {
        alert(result.error || "Approve failed.")
        return
      }

      await loadRequests(false)
      alert("Request approved. User is now premium.")
    } catch (error) {
      console.error("Approve request error:", error)
      alert("Approve failed.")
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function rejectRequest(request: UpgradeRequest) {
    try {
      setUpdatingStatus(true)

      const response = await fetch("/api/admin/upgrades/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          upgradeId: request.id,
        }),
      })

      const text = await response.text()
      let result: { error?: string; success?: boolean } = {}

      try {
        result = text ? JSON.parse(text) : {}
      } catch {
        result = { error: text || "Invalid server response" }
      }

      if (!response.ok) {
        alert(result.error || "Reject failed.")
        return
      }

      await loadRequests(false)
      alert("Request rejected.")
    } catch (error) {
      console.error("Reject request error:", error)
      alert("Reject failed.")
    } finally {
      setUpdatingStatus(false)
    }
  }

  async function deleteRequest(id: string) {
    const confirmed = window.confirm("Delete this upgrade request?")
    if (!confirmed) return

    try {
      setDeletingRequest(true)

      const { error } = await supabase.from("upgrades").delete().eq("id", id)

      if (error) {
        console.error("Delete upgrade request error:", error)
        alert(`Delete failed: ${error.message}`)
        return
      }

      setSelectedRequest(null)
      await loadRequests(false)
      alert("Request deleted.")
    } finally {
      setDeletingRequest(false)
    }
  }

  async function sendReply() {
    if (!selectedRequest) return

    const trimmed = replyBody.trim()
    if (!trimmed) return

    try {
      setSavingReply(true)

      const { error } = await supabase
        .from("upgrades")
        .update({
          admin_reply: trimmed,
          status:
            selectedRequest.status === "approved" || selectedRequest.status === "rejected"
              ? selectedRequest.status
              : "pending",
        })
        .eq("id", selectedRequest.id)

      if (error) {
        console.error("Send admin reply error:", error)
        alert(`Reply failed: ${error.message}`)
        return
      }

      setReplyBody("")
      await loadRequests(false)
      alert("Reply saved.")
    } finally {
      setSavingReply(false)
    }
  }

  async function saveRequestEdit() {
    if (!selectedRequest) return

    try {
      setSavingRequestEdit(true)

      const { error } = await supabase
        .from("upgrades")
        .update({
          name: editName.trim() || null,
          email: editEmail.trim() || null,
          plan: editPlan.trim() || "premium",
          subject: editSubject.trim() || null,
          body: editBody.trim() || null,
        })
        .eq("id", selectedRequest.id)

      if (error) {
        console.error("Edit request error:", error)
        alert(`Save failed: ${error.message}`)
        return
      }

      setIsEditingRequest(false)
      await loadRequests(false)
      alert("Request updated.")
    } finally {
      setSavingRequestEdit(false)
    }
  }

  async function saveReplyEdit() {
    if (!selectedRequest) return

    try {
      setSavingReplyEdit(true)

      const { error } = await supabase
        .from("upgrades")
        .update({
          admin_reply: editReplyText.trim() || null,
        })
        .eq("id", selectedRequest.id)

      if (error) {
        console.error("Edit reply error:", error)
        alert(`Save failed: ${error.message}`)
        return
      }

      setIsEditingReply(false)
      await loadRequests(false)
      alert("Reply updated.")
    } finally {
      setSavingReplyEdit(false)
    }
  }

  async function deleteAdminReply() {
    if (!selectedRequest) return

    const confirmed = window.confirm("Delete the admin reply?")
    if (!confirmed) return

    const { error } = await supabase
      .from("upgrades")
      .update({ admin_reply: null })
      .eq("id", selectedRequest.id)

    if (error) {
      console.error("Delete admin reply error:", error)
      alert(`Delete failed: ${error.message}`)
      return
    }

    setIsEditingReply(false)
    setEditReplyText("")
    await loadRequests(false)
    alert("Admin reply deleted.")
  }

  function getStatusLabel(req: UpgradeRequest) {
    return (req.status || "pending").toLowerCase()
  }

  function getInitial(name: string | null, email: string | null) {
    const value = (name || email || "U").trim()
    return value.charAt(0).toUpperCase()
  }

  function getStatusClasses(status: string) {
    if (status === "approved") return "bg-emerald-100 text-emerald-700"
    if (status === "rejected") return "bg-red-100 text-red-700"
    return "bg-amber-100 text-amber-700"
  }

  function isImage(url: string) {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
  }

  function isPdf(url: string) {
    return /\.pdf$/i.test(url)
  }

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase()

    return requests.filter((req) => {
      const matchesSearch =
        !term ||
        (req.name || "").toLowerCase().includes(term) ||
        (req.email || "").toLowerCase().includes(term) ||
        (req.plan || "").toLowerCase().includes(term) ||
        (req.subject || "").toLowerCase().includes(term) ||
        (req.body || "").toLowerCase().includes(term) ||
        (req.admin_reply || "").toLowerCase().includes(term)

      const status = getStatusLabel(req)
      const matchesFilter = filter === "all" ? true : status === filter

      return matchesSearch && matchesFilter
    })
  }, [requests, search, filter])

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((req) => getStatusLabel(req) === "pending").length,
      approved: requests.filter((req) => getStatusLabel(req) === "approved").length,
      rejected: requests.filter((req) => getStatusLabel(req) === "rejected").length,
    }
  }, [requests])

  if (checkingAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4">
        <div className="rounded-[24px] border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-lg font-bold text-slate-800">Checking admin access...</p>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] via-[#f8fbff] to-white px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <AdminHeader />

        <div className="mb-5">
          <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
            Upgrades
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Review and manage premium upgrade requests.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Total Requests", value: stats.total, color: "text-slate-900" },
            { label: "Pending", value: stats.pending, color: "text-amber-600" },
            { label: "Approved", value: stats.approved, color: "text-emerald-600" },
            { label: "Rejected", value: stats.rejected, color: "text-red-600" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="text-xs font-bold text-slate-500 sm:text-sm">
                {item.label}
              </div>

              <div className={`mt-2 text-3xl font-extrabold sm:text-[42px] ${item.color}`}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, subject, or message"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 lg:flex-1"
            />

            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "approved", "rejected"] as FilterType[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-xl px-4 py-3 text-sm font-bold capitalize transition ${
                    filter === item
                      ? "border border-blue-600 bg-blue-600 text-white"
                      : "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {item.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4 text-lg font-extrabold text-slate-900">
              Upgrade Requests
            </div>

            <div className="max-h-[650px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-5 text-sm text-slate-500">
                  Loading upgrade requests...
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="px-4 py-5 text-sm text-slate-500">
                  No upgrade requests yet.
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const active = selectedRequest?.id === req.id
                  const status = getStatusLabel(req)

                  return (
                    <button
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-left transition ${
                        active ? "bg-blue-50" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-extrabold text-blue-700">
                        {getInitial(req.name, req.email)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 truncate text-sm font-extrabold text-slate-900 sm:text-base">
                          {req.name || "No name"}
                        </div>

                        <div className="mb-2 truncate text-xs text-slate-600 sm:text-sm">
                          {req.subject || "Premium upgrade request"}
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${getStatusClasses(
                              status
                            )}`}
                          >
                            {status.replace("_", " ")}
                          </span>

                          <span className="shrink-0 whitespace-nowrap text-xs text-slate-500">
                            {new Date(req.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        {req.receipt_url && (
                          <div className="mt-2 text-[11px] font-bold text-violet-600">
                            Receipt attached
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            {!selectedRequest ? (
              <div className="text-sm text-slate-500">
                Select an upgrade request to view details.
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-extrabold text-slate-900 sm:text-[26px]">
                      {selectedRequest.subject || "Premium upgrade request"}
                    </h2>

                    <div className="mt-2 text-sm leading-7 text-slate-600">
                      <div>
                        <strong>Name:</strong> {selectedRequest.name || "No name"}
                      </div>
                      <div>
                        <strong>Email:</strong> {selectedRequest.email || "No email"}
                      </div>
                      <div>
                        <strong>Plan:</strong> {selectedRequest.plan || "premium"}
                      </div>
                      <div>
                        <strong>Status:</strong>{" "}
                        {(selectedRequest.status || "pending").replace("_", " ")}
                      </div>
                      <div>
                        <strong>Date:</strong>{" "}
                        {new Date(selectedRequest.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setIsEditingRequest((prev) => !prev)
                        setIsEditingReply(false)
                      }}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                    >
                      {isEditingRequest ? "Cancel Edit" : "Edit Request"}
                    </button>

                    <button
                      onClick={() => deleteRequest(selectedRequest.id)}
                      disabled={deletingRequest}
                      className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deletingRequest ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>

                {isEditingRequest ? (
                  <div className="mb-5 grid gap-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Name"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />

                    <input
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />

                    <input
                      value={editPlan}
                      onChange={(e) => setEditPlan(e.target.value)}
                      placeholder="Plan"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />

                    <input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Subject"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />

                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      placeholder="Request message"
                      rows={5}
                      className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={saveRequestEdit}
                        disabled={savingRequestEdit}
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {savingRequestEdit ? "Saving..." : "Save Request"}
                      </button>

                      <button
                        onClick={() => setIsEditingRequest(false)}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                    <div className="whitespace-pre-wrap">
                      {selectedRequest.body || "No message"}
                    </div>
                  </div>
                )}

                {selectedRequest.admin_reply && !isEditingReply && (
                  <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-bold text-blue-700">
                        Admin Reply
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setIsEditingReply(true)
                            setIsEditingRequest(false)
                            setEditReplyText(selectedRequest.admin_reply || "")
                          }}
                          className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
                        >
                          Edit Reply
                        </button>

                        <button
                          onClick={deleteAdminReply}
                          className="rounded-lg bg-red-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-red-600"
                        >
                          Delete Reply
                        </button>
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                      {selectedRequest.admin_reply}
                    </div>
                  </div>
                )}

                {isEditingReply && (
                  <div className="mt-5 border-t border-slate-200 pt-5">
                    <h3 className="mb-3 text-lg font-extrabold text-slate-900">
                      Edit Admin Reply
                    </h3>

                    <textarea
                      value={editReplyText}
                      onChange={(e) => setEditReplyText(e.target.value)}
                      placeholder="Edit admin reply..."
                      rows={5}
                      className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                    />

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <button
                        onClick={saveReplyEdit}
                        disabled={savingReplyEdit}
                        className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {savingReplyEdit ? "Saving..." : "Save Reply"}
                      </button>

                      <button
                        onClick={() => {
                          setIsEditingReply(false)
                          setEditReplyText(selectedRequest.admin_reply || "")
                        }}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!selectedRequest.admin_reply && !isEditingReply && (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                    No admin reply yet.
                  </div>
                )}

                {selectedRequest.receipt_url && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="mb-3 text-lg font-extrabold text-slate-900">
                      Submitted Receipt
                    </h3>

                    {isImage(selectedRequest.receipt_url) && (
                      <img
                        src={selectedRequest.receipt_url}
                        alt="Submitted receipt"
                        className="w-full max-w-[260px] rounded-xl border border-slate-200 bg-white"
                      />
                    )}

                    {isPdf(selectedRequest.receipt_url) && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">
                        PDF receipt uploaded
                      </div>
                    )}

                    <div className="mt-3">
                      <a
                        href={selectedRequest.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
                      >
                        Open Receipt
                      </a>
                    </div>

                    {selectedRequest.receipt_path && (
                      <p className="mt-3 break-all text-xs text-slate-500">
                        <strong>Storage path:</strong> {selectedRequest.receipt_path}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-5 border-t border-slate-200 pt-5">
                  <h3 className="mb-3 text-lg font-extrabold text-slate-900">
                    Send Reply
                  </h3>

                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Write your admin reply here..."
                    rows={5}
                    className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
                  />

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      onClick={sendReply}
                      disabled={savingReply || !replyBody.trim()}
                      className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {savingReply
                        ? "Saving..."
                        : selectedRequest.admin_reply
                          ? "Replace Reply"
                          : "Send Reply"}
                    </button>

                    <button
                      onClick={() => approveRequest(selectedRequest)}
                      disabled={updatingStatus}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingStatus ? "Working..." : "Approve"}
                    </button>

                    <button
                      onClick={() => rejectRequest(selectedRequest)}
                      disabled={updatingStatus}
                      className="inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingStatus ? "Working..." : "Reject"}
                    </button>

                    <button
                      onClick={() => setPending(selectedRequest.id)}
                      disabled={updatingStatus}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingStatus ? "Working..." : "Set Pending"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}