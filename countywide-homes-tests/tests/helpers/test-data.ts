export const TestData = {
  adminUser: {
    email: 'admin@countywide.com',
    password: 'Admin123!',
    role: 'admin',
    name: 'Admin User'
  },
  
  caseWorkerUser: {
    email: 'caseworker@countywide.com',
    password: 'CaseWorker123!',
    role: 'case_worker',
    name: 'Case Worker'
  },
  
  tenantUser: {
    email: 'tenant@example.com',
    password: 'Tenant123!',
    role: 'tenant',
    name: 'John Tenant',
    unitId: 'unit-001'
  },
  
  mfaUser: {
    email: 'mfa@countywide.com',
    password: 'MFA123!',
    role: 'admin',
    name: 'MFA Admin'
  },
  
  testBuilding: {
    name: 'Test Building',
    address: '123 Test Street',
    city: 'Test City',
    state: 'CA',
    zipCode: '90210',
    units: 10,
    managerId: 'manager-001'
  },
  
  testUnit: {
    unitNumber: '101',
    bedrooms: 2,
    bathrooms: 1,
    rentAmount: 1500,
    status: 'available',
    squareFeet: 850
  },
  
  testTenant: {
    firstName: 'Test',
    lastName: 'Tenant',
    email: 'test.tenant@example.com',
    phone: '555-0123',
    dateOfBirth: '1990-01-01',
    ssn: '123-45-6789'
  },
  
  testServiceRequest: {
    title: 'Test Service Request',
    description: 'This is a test service request for E2E testing',
    priority: 'medium',
    category: 'maintenance',
    status: 'open'
  },
  
  testLease: {
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    monthlyRent: 1500,
    securityDeposit: 3000,
    status: 'active'
  }
};

export const generateRandomEmail = (): string => {
  const timestamp = Date.now();
  return `test.${timestamp}@example.com`;
};

export const generateRandomPhone = (): string => {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const prefix = Math.floor(Math.random() * 900) + 100;
  const lineNumber = Math.floor(Math.random() * 9000) + 1000;
  return `${areaCode}-${prefix}-${lineNumber}`;
};

export const generateRandomSSN = (): string => {
  const area = Math.floor(Math.random() * 900) + 100;
  const group = Math.floor(Math.random() * 90) + 10;
  const serial = Math.floor(Math.random() * 9000) + 1000;
  return `${area}-${group}-${serial}`;
};