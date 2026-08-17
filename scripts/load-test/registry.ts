export interface RegisteredProperty {
  id: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface RegisteredCustomer {
  userId: string;
  customerId: string;
  email: string;
  password?: string;
  magicLinkToken?: string;
  customerSessionToken?: string;
  isActivated: boolean;
  properties: RegisteredProperty[];
}

export interface RegisteredDispatcher {
  userId: string;
  email: string;
  sessionToken?: string;
}

export interface RegisteredTechnician {
  userId: string;
  technicianId: string;
  email: string;
  sessionToken?: string;
}

export interface RegisteredJob {
  id: string;
  appointmentId: string;
  customerId: string;
  technicianId?: string;
  status: string;
}

export interface RegisteredInvoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  customerId: string;
  total: number;
  amountPaid: number;
  status: string;
  paymentToken?: string;
}

export interface RegisteredEstimate {
  id: string;
  estimateNumber: string;
  customerId: string;
  total: number;
  status: string;
}

export interface RegisteredPhoto {
  id: string;
  jobId: string;
  storageKey: string;
  customerVisible: boolean;
}

export interface RegisteredCompany {
  organizationId: string;
  slug: string;
  name: string;
  phone: string;
  email: string;
  stripeAccountId: string;
  ownerUserId: string;
  ownerSessionToken?: string;
  dispatchers: RegisteredDispatcher[];
  technicians: RegisteredTechnician[];
  customers: RegisteredCustomer[];
  jobs: RegisteredJob[];
  invoices: RegisteredInvoice[];
  estimates: RegisteredEstimate[];
  photos: RegisteredPhoto[];
}

export class TestRegistry {
  private companies: Map<string, RegisteredCompany> = new Map();
  private sharedCustomers: Map<string, RegisteredCustomer[]> = new Map(); // email -> customers in multiple orgs

  public registerCompany(company: RegisteredCompany) {
    this.companies.set(company.organizationId, company);
  }

  public getCompany(orgId: string): RegisteredCompany | undefined {
    return this.companies.get(orgId);
  }

  public getAllCompanies(): RegisteredCompany[] {
    return Array.from(this.companies.values());
  }

  public getCompanyBySlug(slug: string): RegisteredCompany | undefined {
    return Array.from(this.companies.values()).find((c) => c.slug === slug);
  }

  public registerSharedCustomer(email: string, customer: RegisteredCustomer) {
    const existing = this.sharedCustomers.get(email) || [];
    existing.push(customer);
    this.sharedCustomers.set(email, existing);
  }

  public getSharedCustomers(): Map<string, RegisteredCustomer[]> {
    return this.sharedCustomers;
  }

  /**
   * Returns a foreign company distinct from the provided organizationId.
   */
  public getForeignCompany(sourceOrgId: string): RegisteredCompany | undefined {
    const others = this.getAllCompanies().filter((c) => c.organizationId !== sourceOrgId);
    if (others.length === 0) return undefined;
    return others[Math.floor(Math.random() * others.length)];
  }

  public getSummaryCounts() {
    let totalDispatchers = 0;
    let totalTechnicians = 0;
    let totalCustomers = 0;
    let totalProperties = 0;
    let totalJobs = 0;
    let totalInvoices = 0;
    let totalEstimates = 0;
    let totalPhotos = 0;

    for (const company of this.companies.values()) {
      totalDispatchers += company.dispatchers.length;
      totalTechnicians += company.technicians.length;
      totalCustomers += company.customers.length;
      totalProperties += company.customers.reduce((acc, c) => acc + c.properties.length, 0);
      totalJobs += company.jobs.length;
      totalInvoices += company.invoices.length;
      totalEstimates += company.estimates.length;
      totalPhotos += company.photos.length;
    }

    return {
      companiesCount: this.companies.size,
      totalDispatchers,
      totalTechnicians,
      totalCustomers,
      totalProperties,
      totalJobs,
      totalInvoices,
      totalEstimates,
      totalPhotos,
    };
  }
}
