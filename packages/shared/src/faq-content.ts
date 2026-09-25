// The FAQ page's content — grouped the same way support_case_category is
// (lib/support-case-categories.ts), so "the thing someone asks about" and
// "the thing someone later files a case about" line up, and a planner who
// doesn't find their answer here lands in a category the report form
// already recognizes.
//
// STANDING RULE (Andre's own instruction): this content describes how the
// product actually behaves right now, not how it behaved when a given entry
// was written. Whenever a session changes a flow, policy, or limit this
// file describes — payment tracking, vendor verification, budget/vendor
// linking, chat gating, and so on — update the matching entry in the same
// session, the same way docs/gather_web_architecture.md and teachAndre/ are
// kept current. Treat a stale answer here as a real bug, since unlike an
// internal doc, this one is shown directly to users.
export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqSection {
  category: string;
  items: FaqItem[];
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    category: "Payments & Billing",
    items: [
      {
        question: "How do payment plans work?",
        answer:
          "For each vendor you book, you can set up a payment plan with a total amount and, optionally, a deposit. You add installments yourself (an amount and due date each) and mark them paid as the money actually moves — tracking is manual for now, there's no card checkout built in yet. A new plan starts as a draft, where you can still freely adjust the total and installments; tap \"Activate Plan\" once the numbers are final — installments can only be marked paid after that, so nothing gets marked paid against figures that might still change.",
      },
      {
        question: "I paid a vendor by mistake, or need a refund recorded — what do I do?",
        answer:
          "Open that installment on the Payments page and tap \"Mark Refunded.\" The original paid date stays on the record (it's still true that it was paid then), but it no longer counts toward your Paid total, and the vendor link is free to remove or change again.",
      },
      {
        question: "Where do I attach proof of payment (a receipt or bank confirmation)?",
        answer:
          "On the Payments page, each installment has a spot to attach a photo or PDF of your proof of payment — tap it to upload, so it's tied to that exact payment instead of buried in an email somewhere.",
      },
      {
        question: "Why can't I remove a vendor or unlink them from a budget item?",
        answer:
          "If any installment on that vendor's payment plan is already marked paid, removal is blocked until you mark it refunded first — this stops a real payment's only record of what it was for from disappearing by accident. Once removal does go through, that vendor's payment plan (and its installments) is deleted for good, and it's automatically unlinked from any budget line it was attached to — so double-check before removing.",
      },
    ],
  },
  {
    category: "Vendor Booking & Communication",
    items: [
      {
        question: "Why can't I send a message from my vendor account?",
        answer:
          "Sending is only available once your listing is verified — until then you can still read messages that come in, but replying is blocked. Claim your listing (if you haven't) and wait for verification to open it up. This only affects the vendor side: a planner can always message a vendor regardless of that vendor's verification status.",
      },
      {
        question: "How many vendors can I link to one budget item?",
        answer:
          "Just one. If you're comparing two vendors for the same need (say, two florists), give each its own budget line rather than trying to link both to one.",
      },
      {
        question: "How do I know if a vendor has replied to me?",
        answer: "A count badge appears next to the vendor's name on your event's vendor list once they've sent a new message you haven't opened yet. There's no read receipt for messages you send — just an unread count for what's waiting on you.",
      },
      {
        question: "Why can't I write a review for a vendor?",
        answer:
          "Reviews are only open once you've actually booked that vendor — their status on your event needs to be \"Contracted.\" This keeps reviews tied to a real booking rather than a browse. Once you're eligible, \"Write a Review\" appears on the vendor's own profile page; the vendor can reply publicly, and you can edit your review later if you want to change it.",
      },
    ],
  },
  {
    category: "Event Setup & Guests",
    items: [
      {
        question: "How does the budget page's \"under/over budget\" line work?",
        answer:
          "It compares what you budgeted for a line against that vendor's full agreed cost (their payment plan total) — not how much you've paid so far. Coming in under your budgeted amount always means you have room to spare, never that more is owed.",
      },
      {
        question: "Can guests see my event before I publish it?",
        answer: "No — only you, your co-planners, and anyone you've invited can see a draft event. It only becomes publicly discoverable once its status is Published and its visibility is set to Public.",
      },
      {
        question: "What's the countdown card on my event page?",
        answer: "A live countdown to your event's start time, shown to you and anyone viewing the event (including guests) until the event begins.",
      },
    ],
  },
  {
    category: "Account & Verification",
    items: [
      {
        question: "How do I claim a vendor listing as my own business?",
        answer:
          "Open the vendor's page and tap \"Claim this business,\" then tell us how we can confirm it's really yours. An admin reviews claims by hand before your listing goes live under your account.",
      },
      {
        question: "How does my business get featured?",
        answer:
          "When featured spots are open, the business owner can tap \"Get featured\" on the vendor dashboard, pick a top spot or the rotating row, choose 1 week, 1 month or 3 months, and send a request. Nothing is charged when you ask — Gather confirms the price and dates with you first, and the spot only goes live once it's confirmed. You can see the prices on the Get featured page, and withdraw a request while it's still waiting.",
      },
      {
        question: "What can Owners, Managers and Staff on a vendor team do?",
        answer:
          "Owners run the business: everything a Manager can do, plus managing the team and requesting featured spots. Managers edit the business profile, services and gallery, send quotes, reply to reviews and see payments. Staff can chat with planners, add photos to the gallery, keep private team notes on a booking, and suggest a quote — a Manager reviews it before the planner sees it. Staff don't see prices or payments.",
      },
      {
        question: "I manage both events and a vendor business — do I need two accounts?",
        answer:
          "No. If your account is linked to both a planner profile and a vendor team, Gather asks who you're here as each time you log in, and you can switch any time from your Profile tab without signing out.",
      },
      {
        question: "How do I add another business, and is there a limit?",
        answer:
          "Tap \"+ Add a business\" on your Profile tab. You can own up to 5 businesses, one per category — so not two Photography businesses, for example. If you genuinely need more, or a second one in the same category, the form lets you send a request with a short reason; once an admin approves it, come back and create it as normal.",
      },
      {
        question: "Why can't I add another listing today?",
        answer:
          "To keep the marketplace free of spam, each person can add a limited number of vendor listings per 24 hours — placeholder listings for vendors not on Gather yet and your own businesses together. Try again the next day, or report an issue from your Profile if you genuinely need more.",
      },
      {
        question: "It says I'm \"doing that a lot\" — what happened?",
        answer:
          "To protect Gather from spam and automated abuse, there's a generous hourly limit on how many of each thing one person can create — events, messages, invites and so on. Normal use never gets close; if you hit it, wait a little while and try again, or report an issue from your Profile if it keeps happening.",
      },
      {
        question: "I can't create an account — is something wrong?",
        answer:
          "Sign-ups are occasionally paused for a short while. If the sign-up page says so, please check back soon. If you already have an account you can still log in as normal.",
      },
      {
        question: "How do I stop Gather news and announcement emails?",
        answer:
          "Tap \"Unsubscribe from Gather announcements\" at the bottom of any announcement email, or untick \"Gather news & announcements\" under Notifications on your Profile tab. Reminders about your own events and emails about your account still arrive — turn off email reminders on your Profile if you don't want those either.",
      },
      {
        question: "How do I delete my account, and what happens to my data?",
        answer:
          "Open your Profile tab, scroll to \"Your data\" and choose \"Delete my account\". Your events, guest lists, tasks and budgets are deleted, and you leave every business team (a business with no one left on it is hidden). Messages and other things you wrote for other people stay, but show as \"Deleted user\". It can't be undone. To get a copy of your information first, email us — the privacy policy has the address.",
      },
      {
        question: "Can't find an answer here?",
        answer: "Report it from your Profile tab and we'll take a look — you'll be able to check back on the status from there too.",
      },
    ],
  },
];
