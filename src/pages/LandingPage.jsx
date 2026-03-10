import React from "react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">

      <div className="max-w-6xl w-full bg-gradient-to-r from-blue-200 to-blue-300 rounded-3xl p-12 flex items-center justify-between shadow-xl">

        {/* LEFT SIDE */}
        <div className="max-w-xl">

          {/* LOGO */}
          <img
            src="/jb-logo.png"
            alt="JB Collections"
            className="w-40 mb-6"
          />

          {/* TITLE */}
          <h1 className="text-4xl font-bold text-gray-900 leading-tight">
            Elevate your Experience <br />
            with <span className="text-blue-700">JB Collections</span>
          </h1>

          {/* DESCRIPTION */}
          <p className="text-gray-700 mt-4">
            Discover expansive resources, exclusive contents, and premium
            downloads for members. Join for free or upgrade anytime.
          </p>

          {/* BUTTONS */}
          <div className="flex gap-4 mt-8">

            <a
              href="/login"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg shadow hover:bg-blue-700 transition"
            >
              Login
            </a>

            <a
              href="/signup"
              className="border border-blue-600 text-blue-700 px-8 py-3 rounded-lg hover:bg-blue-50 transition"
            >
              Create Account
            </a>

          </div>
        </div>

        {/* RIGHT SIDE PREVIEW */}
        <div className="hidden md:block">
          <img
            src="/jb-logo.png"
            alt="JB Collections Preview"
            className="w-80 opacity-30"
          />
        </div>

      </div>

    </div>
  );
}