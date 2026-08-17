# AquaFlow Browser Workflow Verification Matrix

| Workflow Domain | Start Route | Browser Actions Executed | Success Verification | Tenant Isolation Verified | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Admin Company Setup** | `/onboarding` & `/dashboard/settings` | Save company profile, tax rules, business hours | DB Organization updated | Strict tenantId scope | 🟢 **PASS** |
| **2. Staff & Tech Management**| `/dashboard/techs` | Click "Add Technician", fill name/email/phone, save | New tech in table & auth DB | Cannot see Org B techs | 🟢 **PASS** |
| **3. Service Management** | `/dashboard/settings` | Create new service, edit price/duration, toggle active | Service appears in public booking | Scoped to Org | 🟢 **PASS** |
| **4. Customer Management** | `/dashboard/customers` | Add customer, enter address, view profile & jobs | Customer & Property in DB | Isolated to Org | 🟢 **PASS** |
| **5. Public Customer Booking**| `/p/[slug]/book` | 4-step wizard: select service, date, address, submit | Appointment & Job created | Correct tenant slug bound | 🟢 **PASS** |
| **6. Dispatcher Assignment** | `/dashboard/jobs/[id]` | View job, select technician from dropdown, click Assign | Job.technicianId set, status ASSIGNED | Cannot assign Org B tech | 🟢 **PASS** |
| **7. Tech Mobile Field Work** | `/tech/dashboard` | En Route ➔ Arrived ➔ Start Work ➔ Clock In ➔ Parts ➔ Photo ➔ Signature | State transitions, timeEntry, photo stored | Tech cannot open Org B job | 🟢 **PASS** |
| **8. Invoicing & Billing** | `/dashboard/invoices` | Generate invoice from completed job, view totals & tax | Invoice with line items & tax rule | Scoped to Org | 🟢 **PASS** |
| **9. Stripe Payment Flow** | `/pay/[token]` | Open tokenized checkout, enter test card, submit | Payment recorded, invoice marked PAID | Webhook verified | 🟢 **PASS** |
| **10. Customer Portal** | `/portal/dashboard` | View jobs, approve estimate, pay invoice, open ticket | Customer actions reflect in DB | Cannot view Org B data | 🟢 **PASS** |
| **11. Customer Support Desk**| `/portal/support/new` ➔ `/dashboard/support` | Customer opens ticket, dispatcher replies, status updates | Thread rendered & status WAITING_CUSTOMER | Isolated per org | 🟢 **PASS** |
| **12. Navigation & Mobile** | All routes | Click all sidebar/nav links, test at 390x844 viewport | 0 dead links, 0 404s, responsive | Mobile friendly | 🟢 **PASS** |
