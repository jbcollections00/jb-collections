"use client"

import SiteHeader from "../components/SiteHeader"
import { useState } from "react"

type TutorialStep = {
  title: string
  description: string
}

type TutorialScreenshot = {
  src: string
  title: string
  description: string
}

type Tutorial = {
  title: string
  icon: string
  summary: string
  steps: TutorialStep[]
  screenshots?: TutorialScreenshot[]
  tips?: string[]
  mistakes?: string[]
  notes?: string[]
}

const tutorials: Tutorial[] = [
  {
    title: "How to Create an Account",
    icon: "📝",
    summary:
      "Create your JB Collections account so you can access the dashboard, earn coins, open Mystery Box, and download files.",
    steps: [
      {
        title: "Open the Sign Up page",
        description:
          "From the homepage or login page, click Sign Up or Create Account. This page is for new users who do not have an account yet.",
      },
      {
        title: "Enter your email address",
        description:
          "Type a valid email address. This email will be used when you log in and may also be used for account recovery.",
      },
      {
        title: "Create your password",
        description:
          "Choose a password that you can remember but is difficult for others to guess. Avoid using very simple passwords.",
      },
      {
        title: "Submit your registration",
        description:
          "Click the Sign Up button and wait for the site to finish creating your account.",
      },
      {
        title: "Log in after signup",
        description:
          "After your account is created, go to the Login page and sign in using the email and password you registered.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/signup-1-form.png",
        title: "Sign Up form",
        description:
          "This screenshot should show the email field, password field, and Sign Up button.",
      },
    ],
    tips: [
      "Use the same email every time you log in.",
      "Do not share your password with anyone.",
      "If signup does not work, refresh the page and try again.",
    ],
    mistakes: [
      "Typing the wrong email address.",
      "Using a password that is too easy to guess.",
      "Trying to create a new account when you already have one.",
    ],
  },
  {
    title: "How to Log In",
    icon: "🔐",
    summary:
      "Log in to your account so you can access your dashboard, wallet, rewards, and downloads.",
    steps: [
      {
        title: "Open the Login page",
        description:
          "Go to the Login page from the homepage or from any page that asks you to sign in.",
      },
      {
        title: "Enter your registered email",
        description:
          "Use the same email address you used when you created your account.",
      },
      {
        title: "Enter your password",
        description:
          "Type your password carefully. Check capital letters, numbers, and symbols if your password includes them.",
      },
      {
        title: "Click Login",
        description:
          "Press the Login button and wait for the website to verify your account.",
      },
      {
        title: "Confirm you are logged in",
        description:
          "If your dashboard opens and your JB Wallet appears in the header, your login was successful.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/login-1-form.png",
        title: "Login form",
        description:
          "This screenshot should show the email field, password field, and Login button.",
      },
    ],
    tips: [
      "If login fails, check your email and password.",
      "Refresh the page if the dashboard does not load.",
      "Use password recovery if you forgot your password.",
    ],
    mistakes: [
      "Using an email that was not registered.",
      "Typing extra spaces before or after the email.",
      "Using the wrong password.",
    ],
  },
  {
    title: "How to Check Your JB Coins",
    icon: "🪙",
    summary:
      "Learn where to find your JB Wallet and how to confirm that your coin balance updated correctly.",
    steps: [
      {
        title: "Log in first",
        description:
          "Your wallet balance is connected to your account, so you must be logged in to see the correct balance.",
      },
      {
        title: "Look at the Site Header",
        description:
          "At the top of the page, find the section labeled JB Wallet. This shows your current coin balance.",
      },
      {
        title: "Read your current balance",
        description:
          "The number beside JB is the amount of JB Coins currently available in your wallet.",
      },
      {
        title: "Refresh after earning or spending",
        description:
          "After earning, buying, or spending coins, refresh the page if the balance does not update right away.",
      },
      {
        title: "Check again after actions",
        description:
          "After opening Mystery Box or completing a task, confirm that your wallet balance changed.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/wallet-1-header.png",
        title: "Wallet in the header",
        description:
          "This screenshot should show the JB Wallet area in the Site Header.",
      },
      {
        src: "/tutorials/wallet-2-updated-balance.png",
        title: "Updated wallet balance",
        description:
          "This screenshot should show the wallet after coins have been added.",
      },
    ],
    tips: [
      "Your wallet is usually shown in the top navigation bar.",
      "Coins may update automatically after some actions.",
      "If your balance looks wrong, refresh the page or log in again.",
    ],
    mistakes: [
      "Checking the wallet while logged out.",
      "Expecting coins to update before the action is complete.",
    ],
  },
  {
    title: "How to Earn Coins",
    icon: "🎯",
    summary:
      "Complete available tasks on the Earn Coins page to receive JB Coins in your wallet.",
    steps: [
      {
        title: "Open Earn Coins",
        description:
          "Click Earn Coins from the Site Header or menu. This page shows available ways to earn JB Coins.",
      },
      {
        title: "Read the task details",
        description:
          "Each task may have its own instructions, reward amount, and completion requirement. Read everything before starting.",
      },
      {
        title: "Start a task",
        description:
          "Click the task button or action button to begin. Follow the instructions exactly as shown.",
      },
      {
        title: "Complete the task properly",
        description:
          "Do not close the page too early. Some tasks need time to verify before rewards are added.",
      },
      {
        title: "Check your reward",
        description:
          "After completion, look for a success message or check your JB Wallet to confirm that coins were added.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/earn-coins-1-page-overview.png",
        title: "Earn Coins page overview",
        description:
          "This screenshot should show the top section of the Earn Coins page.",
      },
      {
        src: "/tutorials/earn-coins-2-task-list.png",
        title: "Available task list",
        description:
          "This screenshot should show task cards, reward amounts, or start buttons.",
      },
      {
        src: "/tutorials/earn-coins-3-reward-added.png",
        title: "Reward added",
        description:
          "This screenshot should show a success message or updated JB Wallet after earning coins.",
      },
    ],
    tips: [
      "Read all task instructions before clicking.",
      "Wait for the task to finish verifying.",
      "Refresh the page if your wallet does not update immediately.",
    ],
    mistakes: [
      "Closing the task before completion.",
      "Clicking repeatedly while the page is loading.",
      "Skipping required task instructions.",
    ],
  },
  {
    title: "How to Open Mystery Box",
    icon: "🎁",
    summary:
      "Open the Mystery Box once per day to win a random JB Coins reward.",
    steps: [
      {
        title: "Go to Mystery Box",
        description:
          "Click Mystery Box in the Site Header or menu to open the Mystery Box page.",
      },
      {
        title: "Make sure you are logged in",
        description:
          "The reward can only be added if the system can identify your account.",
      },
      {
        title: "Click Open Mystery Box",
        description:
          "Press the Open Mystery Box button once and wait for the result.",
      },
      {
        title: "View your reward",
        description:
          "The page will show a success message with the number of JB Coins you won.",
      },
      {
        title: "Check your wallet",
        description:
          "Look at your JB Wallet in the header to confirm the reward was added.",
      },
      {
        title: "Wait until the next day",
        description:
          "If you already opened the box today, the page will show Already opened today.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/mystery-box-1-page.png",
        title: "Mystery Box page",
        description:
          "This screenshot should show the Mystery Box title and Open Mystery Box button.",
      },
      {
        src: "/tutorials/mystery-box-2-reward.png",
        title: "Reward result",
        description:
          "This screenshot should show the message after winning JB Coins.",
      },
      {
        src: "/tutorials/mystery-box-3-already-opened.png",
        title: "Already opened today",
        description:
          "This screenshot should show the daily cooldown message.",
      },
    ],
    tips: [
      "Mystery Box can only be opened once per day.",
      "Do not refresh repeatedly while the reward is processing.",
      "Check your wallet after claiming.",
    ],
    mistakes: [
      "Trying to open Mystery Box while logged out.",
      "Clicking the button many times.",
      "Expecting multiple rewards in one day.",
    ],
  },
  {
    title: "How to Buy Coins",
    icon: "💳",
    summary:
      "Buy JB Coins by selecting a package and following the payment instructions.",
    steps: [
      {
        title: "Open Buy COINS",
        description:
          "Click Buy COINS from the Site Header or menu.",
      },
      {
        title: "Choose a package",
        description:
          "Select the coin package that matches the number of coins you want to purchase.",
      },
      {
        title: "Review the payment details",
        description:
          "Check the price, payment method, and instructions carefully before sending payment.",
      },
      {
        title: "Complete the payment",
        description:
          "Follow the provided payment instructions. Make sure the payment amount and details are correct.",
      },
      {
        title: "Submit proof if required",
        description:
          "If the site asks for proof of payment, upload or enter the required receipt/reference information.",
      },
      {
        title: "Wait for confirmation",
        description:
          "Coins may be added after payment is verified. Refresh your wallet later if needed.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/buy-coins-1-packages.png",
        title: "Coin packages",
        description:
          "This screenshot should show the available coin packages.",
      },
      {
        src: "/tutorials/buy-coins-2-payment-instructions.png",
        title: "Payment instructions",
        description:
          "This screenshot should show the payment method and instructions.",
      },
      {
        src: "/tutorials/buy-coins-3-confirmation.png",
        title: "Confirmation area",
        description:
          "This screenshot should show confirmation, receipt upload, or payment status if available.",
      },
    ],
    tips: [
      "Always double-check payment details.",
      "Keep your receipt or reference number.",
      "Coins may not appear instantly if manual approval is required.",
    ],
    mistakes: [
      "Sending the wrong payment amount.",
      "Not keeping payment proof.",
      "Expecting instant coins when manual review is required.",
    ],
  },
  {
    title: "How to Use Coins",
    icon: "⚡",
    summary:
      "Use JB Coins to unlock features, access content, or download files depending on the page requirement.",
    steps: [
      {
        title: "Check your wallet",
        description:
          "Before spending coins, make sure your JB Wallet has enough balance.",
      },
      {
        title: "Open locked content",
        description:
          "Go to the feature, file, or content page that requires JB Coins.",
      },
      {
        title: "Check the coin cost",
        description:
          "Read how many coins are required before you click unlock or spend.",
      },
      {
        title: "Confirm unlock",
        description:
          "Click the unlock/spend button only when you are sure you want to use your coins.",
      },
      {
        title: "Access the content",
        description:
          "After successful coin deduction, the locked content or feature should become available.",
      },
      {
        title: "Check remaining balance",
        description:
          "Your JB Wallet should show the updated balance after spending coins.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/use-coins-1-locked-content.png",
        title: "Locked content",
        description:
          "This screenshot should show content that requires coins.",
      },
      {
        src: "/tutorials/use-coins-2-unlock-confirmation.png",
        title: "Unlock confirmation",
        description:
          "This screenshot should show the unlock or spend button.",
      },
      {
        src: "/tutorials/use-coins-3-content-opened.png",
        title: "Content unlocked",
        description:
          "This screenshot should show the content after successful unlock.",
      },
    ],
    tips: [
      "Check the coin cost before confirming.",
      "Refresh if unlocked content does not appear.",
      "Make sure you are using the correct account.",
    ],
    mistakes: [
      "Spending coins without checking the cost.",
      "Trying to unlock content without enough balance.",
    ],
  },
  {
    title: "How to Download Files",
    icon: "⬇️",
    summary:
      "Download files from JB Collections after logging in and unlocking access when required.",
    steps: [
      {
        title: "Log in to your account",
        description:
          "Some downloads require an account, so make sure you are logged in first.",
      },
      {
        title: "Open the file page",
        description:
          "Go to the product, content, or file page where the download is available.",
      },
      {
        title: "Check access requirements",
        description:
          "Some files may require JB Coins or unlocked access before the download button works.",
      },
      {
        title: "Unlock the file if needed",
        description:
          "If the file is locked, follow the page instructions to unlock it first.",
      },
      {
        title: "Click Download",
        description:
          "Click the Download button once and wait for the browser to start downloading.",
      },
      {
        title: "Check your Downloads folder",
        description:
          "After download finishes, check the Downloads folder on your phone or computer.",
      },
      {
        title: "Try again if it fails",
        description:
          "If nothing happens, refresh the page, check browser download permissions, and try again.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/download-files-1-file-page.png",
        title: "File page",
        description:
          "This screenshot should show the page where the file is available.",
      },
      {
        src: "/tutorials/download-files-2-unlock-or-access.png",
        title: "Unlock or access requirement",
        description:
          "This screenshot should show if the file requires coins or access.",
      },
      {
        src: "/tutorials/download-files-3-download-button.png",
        title: "Download button",
        description:
          "This screenshot should show the download button clearly.",
      },
      {
        src: "/tutorials/download-files-4-download-folder.png",
        title: "Downloaded file",
        description:
          "This screenshot should show where the downloaded file appears on the device.",
      },
    ],
    tips: [
      "Check your browser download history.",
      "On mobile, downloaded files may appear in the Files or Downloads app.",
      "Use a stable internet connection for large files.",
    ],
    mistakes: [
      "Clicking download before unlocking the file.",
      "Not checking the Downloads folder.",
      "Closing the page before the download starts.",
    ],
  },
  {
    title: "How Referral Rewards Work",
    icon: "🤝",
    summary:
      "Share your referral link and earn rewards when someone joins or completes the required referral action.",
    steps: [
      {
        title: "Open the Referral section",
        description:
          "Go to the part of the site where your referral link or referral tools are shown.",
      },
      {
        title: "Copy your referral link",
        description:
          "Click the copy button or manually copy your referral URL.",
      },
      {
        title: "Share your link",
        description:
          "Send the link to friends or users who may want to join JB Collections.",
      },
      {
        title: "New user signs up",
        description:
          "The referral usually counts when the new user joins through your exact referral link.",
      },
      {
        title: "Wait for reward requirements",
        description:
          "Some referral systems require the new user to verify, earn, buy, or complete an action first.",
      },
      {
        title: "Receive referral reward",
        description:
          "Once the requirements are met, your reward may be added to your wallet.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/referral-1-referral-section.png",
        title: "Referral section",
        description:
          "This screenshot should show where the referral link is located.",
      },
      {
        src: "/tutorials/referral-2-copy-link.png",
        title: "Copy referral link",
        description:
          "This screenshot should show the copy referral link button.",
      },
      {
        src: "/tutorials/referral-3-reward-status.png",
        title: "Referral reward status",
        description:
          "This screenshot should show referral progress or reward information if available.",
      },
    ],
    tips: [
      "Only share your own referral link.",
      "Make sure your friend opens your exact link before signing up.",
      "Referral rewards depend on the active site rules.",
    ],
    mistakes: [
      "Sharing the wrong link.",
      "Expecting rewards before the referral conditions are completed.",
    ],
  },
  {
    title: "Why Ads Appear",
    icon: "📢",
    summary:
      "Understand why ads may appear on JB Collections and how they help support rewards and platform costs.",
    steps: [
      {
        title: "Understand the purpose of ads",
        description:
          "Ads help support the platform and may help keep rewards, features, and site operations available.",
      },
      {
        title: "Know where ads may appear",
        description:
          "Ads may appear in selected areas such as banners or background placements.",
      },
      {
        title: "Avoid suspicious ads",
        description:
          "Do not enter personal information on random ad pages. Only use trusted pages inside JB Collections.",
      },
      {
        title: "Report bad ads",
        description:
          "If an ad is too aggressive, inappropriate, or interrupts the site too much, report it to support.",
      },
      {
        title: "Continue using the site",
        description:
          "Limited ads should not stop you from using the main features of the site.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/ads-1-banner-example.png",
        title: "Example ad placement",
        description:
          "This screenshot should show a normal banner ad location.",
      },
      {
        src: "/tutorials/ads-2-report-bad-ad.png",
        title: "Report ad issue",
        description:
          "This screenshot should show where users can contact support about disruptive ads.",
      },
    ],
    tips: [
      "Do not click ads unless you are interested.",
      "Never enter passwords or private information on random ad pages.",
      "Report ads that feel unsafe or too aggressive.",
    ],
    mistakes: [
      "Thinking ads are part of the login form.",
      "Entering private details on external ad pages.",
    ],
  },
  {
    title: "Common Problems",
    icon: "🛠️",
    summary:
      "Fix common issues such as login problems, wallet not updating, Mystery Box cooldown, and download problems.",
    steps: [
      {
        title: "If you cannot log in",
        description:
          "Check your email and password. Make sure you are using the correct account and there are no extra spaces.",
      },
      {
        title: "If coins did not update",
        description:
          "Refresh the page first. If it still does not update, log out and log back in.",
      },
      {
        title: "If Mystery Box says Already opened today",
        description:
          "This means your account already claimed the daily reward. Wait until the next day.",
      },
      {
        title: "If download does not start",
        description:
          "Refresh the page, check your browser download permissions, and try again.",
      },
      {
        title: "If the site loads slowly",
        description:
          "Check your internet connection and reload the page.",
      },
      {
        title: "If the problem continues",
        description:
          "Contact support and include your account email, the page URL, and a screenshot of the issue.",
      },
    ],
    screenshots: [
      {
        src: "/tutorials/common-problems-1-error-message.png",
        title: "Example error message",
        description:
          "This screenshot should show an example issue users may encounter.",
      },
      {
        src: "/tutorials/common-problems-2-refresh-login.png",
        title: "Refresh or log in again",
        description:
          "This screenshot should show the action users can take to refresh or return to login.",
      },
      {
        src: "/tutorials/common-problems-3-contact-support.png",
        title: "Contact support",
        description:
          "This screenshot should show how users can contact support if the issue continues.",
      },
    ],
    tips: [
      "Refreshing fixes many small issues.",
      "Screenshots help support understand the problem faster.",
      "Always include the page where the issue happened.",
    ],
    mistakes: [
      "Reporting an issue without explaining what page it happened on.",
      "Not checking if you are logged in first.",
    ],
  },
]

export default function TutorialsPage() {
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null)

  return (
    <>
      <SiteHeader />

      <main className="min-h-screen bg-[#020617] px-4 py-10 text-white sm:px-6 lg:px-8">
        <section className="mx-auto max-w-6xl">
          <div className="mb-8 rounded-[28px] border border-white/10 bg-gradient-to-r from-cyan-600 via-sky-500 to-indigo-600 p-6 shadow-[0_18px_45px_rgba(37,99,235,0.28)] sm:p-8">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-cyan-100">
              Help Center
            </p>

            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
              Tutorials
            </h1>

            <p className="mt-4 max-w-3xl text-sm font-medium leading-7 text-cyan-50/90 sm:text-base">
              Choose a tutorial below to learn how to use JB Collections. Each guide
              includes detailed steps, helpful notes, common mistakes, and screenshots.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tutorials.map((tutorial, index) => (
              <button
                key={tutorial.title}
                type="button"
                onClick={() => setSelectedTutorial(tutorial)}
                className="group rounded-[24px] border border-white/10 bg-white/[0.04] p-5 text-left shadow-[0_14px_35px_rgba(0,0,0,0.25)] transition hover:-translate-y-1 hover:border-cyan-300/40 hover:bg-white/[0.08]"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl transition group-hover:bg-cyan-400/20">
                    {tutorial.icon}
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                      Tutorial {index + 1}
                    </p>
                    <h2 className="text-lg font-black text-white">
                      {tutorial.title}
                    </h2>
                  </div>
                </div>

                <p className="text-sm font-medium leading-6 text-slate-400">
                  {tutorial.summary}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-[24px] border border-yellow-300/20 bg-yellow-300/10 p-5 text-center">
            <h2 className="text-xl font-black text-yellow-300">
              Need more help?
            </h2>
            <p className="mt-2 text-sm text-yellow-50/80">
              If something is not working, contact support and include your account email,
              the page you are using, and a screenshot of the problem.
            </p>
          </div>
        </section>
      </main>

      {selectedTutorial && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#081226] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                  {selectedTutorial.icon}
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                    Tutorial Guide
                  </p>
                  <h2 className="text-2xl font-black text-white">
                    {selectedTutorial.title}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTutorial(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-2xl font-black text-white transition hover:bg-white/20"
                aria-label="Close tutorial"
              >
                ×
              </button>
            </div>

            <div className="mb-6 rounded-2xl border border-cyan-300/10 bg-cyan-400/5 p-4">
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
                Overview
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {selectedTutorial.summary}
              </p>
            </div>

            <div className="space-y-4">
              {selectedTutorial.steps.map((step, stepIndex) => (
                <div
                  key={`${selectedTutorial.title}-${stepIndex}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-500/15 text-sm font-black text-cyan-300 ring-1 ring-cyan-300/20">
                      {stepIndex + 1}
                    </span>

                    <div>
                      <h3 className="text-base font-black text-white">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm leading-7 text-slate-300">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedTutorial.screenshots &&
              selectedTutorial.screenshots.length > 0 && (
                <div className="mt-6">
                  <h3 className="mb-3 text-center text-sm font-black uppercase tracking-[0.18em] text-cyan-300">
                    Screenshots Guide
                  </h3>

                  <div className="grid gap-6">
                    {selectedTutorial.screenshots.map((screenshot, index) => (
                      <div
                        key={`${screenshot.src}-${index}`}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                      >
                        <a
                          href={screenshot.src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex justify-center bg-slate-950/40 p-3"
                        >
                          <img
                            src={screenshot.src}
                            alt={screenshot.title}
                            className="block h-auto max-h-none max-w-full rounded-xl object-contain"
                          />
                        </a>

                        <div className="p-4 text-center">
                          <h4 className="text-sm font-black text-white">
                            {screenshot.title}
                          </h4>
                          <p className="mt-1 text-sm leading-6 text-slate-400">
                            {screenshot.description}
                          </p>
                          <p className="mt-2 text-xs font-bold text-cyan-300">
                            Click image to view full size
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {selectedTutorial.tips && selectedTutorial.tips.length > 0 && (
              <div className="mt-6 rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
                  Helpful Tips
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
                  {selectedTutorial.tips.map((tip, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-emerald-300">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedTutorial.mistakes && selectedTutorial.mistakes.length > 0 && (
              <div className="mt-6 rounded-2xl border border-red-300/15 bg-red-400/5 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-red-300">
                  Common Mistakes to Avoid
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
                  {selectedTutorial.mistakes.map((mistake, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-red-300">•</span>
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedTutorial.notes && selectedTutorial.notes.length > 0 && (
              <div className="mt-6 rounded-2xl border border-yellow-300/15 bg-yellow-400/5 p-4">
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-yellow-300">
                  Important Notes
                </h3>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-300">
                  {selectedTutorial.notes.map((note, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-yellow-300">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedTutorial(null)}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-500 to-purple-600 px-5 py-3 text-sm font-black text-white transition hover:scale-[1.02]"
            >
              Close Tutorial
            </button>
          </div>
        </div>
      )}
    </>
  )
}