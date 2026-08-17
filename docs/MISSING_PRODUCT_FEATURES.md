# Missing Product Features & Remediation Roadmap

## P0 — Required for Beta (Remediated)

### 1. Technician Creation & Roster Management
- **Expected:** Admin ➔ Team/Technicians ➔ Add Technician (First Name, Last Name, Email, Phone, Role, Status) ➔ Save.
- **Previous Gap:** Table was read-only with no UI to add or deactivate employees.
- **Status:** **REMEDIATED (IMPLEMENTED + BROWSER ACCESSIBLE)**

### 2. Service Catalog Management
- **Expected:** Admin ➔ Settings ➔ Services ➔ Add Service (Name, Description, Base Price, Duration, Urgency Type, Active Status) ➔ Save.
- **Previous Gap:** Services were seeded in DB but lacked browser editing controls.
- **Status:** **REMEDIATED (IMPLEMENTED + BROWSER ACCESSIBLE)**

### 3. Company Settings & Stripe Connect Hub
- **Expected:** Admin ➔ Settings ➔ Configure Company Profile, Business Hours, Tax Rules, and Stripe Connect.
- **Previous Gap:** Page returned placeholder text.
- **Status:** **REMEDIATED (IMPLEMENTED + BROWSER ACCESSIBLE)**

### 4. Direct Dispatcher Assignment
- **Expected:** Dispatcher ➔ Job Detail ➔ Select Technician from dropdown ➔ Assign Technician.
- **Previous Gap:** Only AI recommendation acceptance was supported.
- **Status:** **REMEDIATED (IMPLEMENTED + BROWSER ACCESSIBLE)**

---

## P1 — Important Enhancements (Post-Beta)

1. **In-App Live Chat for Technicians & Dispatchers:**
   - Real-time WebSockets / SSE messaging directly between mobile technician workspace and dispatcher board.
2. **Dynamic Route Polyline Drawing:**
   - Live turn-by-turn map polylines plotted directly on the operations dispatch map via Mapbox Directions API.
3. **Automated Review Request Triggers:**
   - Automatically email/SMS Google Review links to homeowners immediately after invoice payment completion.

---

## P2 — Nice to Have (Future Scale)

1. **Inventory & Warehouse Barcode Scanning:**
   - Camera barcode scanner inside Technician Mobile workspace to deduct van parts automatically from central warehouse inventory.
2. **QuickBooks Online / Xero Accounting Bi-directional Sync:**
   - Two-way sync of customers, invoices, and payment reconciliation.
