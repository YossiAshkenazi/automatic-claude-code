import { Page } from '@playwright/test';

export class TestCleanup {
  private createdIds: {
    buildings: string[];
    units: string[];
    tenants: string[];
    serviceRequests: string[];
    leases: string[];
    documents: string[];
  } = {
    buildings: [],
    units: [],
    tenants: [],
    serviceRequests: [],
    leases: [],
    documents: []
  };

  constructor(private page: Page) {}

  trackBuilding(id: string) {
    this.createdIds.buildings.push(id);
  }

  trackUnit(id: string) {
    this.createdIds.units.push(id);
  }

  trackTenant(id: string) {
    this.createdIds.tenants.push(id);
  }

  trackServiceRequest(id: string) {
    this.createdIds.serviceRequests.push(id);
  }

  trackLease(id: string) {
    this.createdIds.leases.push(id);
  }

  trackDocument(id: string) {
    this.createdIds.documents.push(id);
  }

  async cleanupAll() {
    console.log('Starting test data cleanup...');

    // Delete in reverse order of dependencies
    await this.cleanupDocuments();
    await this.cleanupLeases();
    await this.cleanupServiceRequests();
    await this.cleanupTenants();
    await this.cleanupUnits();
    await this.cleanupBuildings();

    console.log('Test data cleanup completed');
  }

  private async cleanupBuildings() {
    for (const id of this.createdIds.buildings) {
      try {
        await this.deleteViaAPI('/api/buildings', id);
      } catch (error) {
        console.error(`Failed to delete building ${id}:`, error);
      }
    }
    this.createdIds.buildings = [];
  }

  private async cleanupUnits() {
    for (const id of this.createdIds.units) {
      try {
        await this.deleteViaAPI('/api/units', id);
      } catch (error) {
        console.error(`Failed to delete unit ${id}:`, error);
      }
    }
    this.createdIds.units = [];
  }

  private async cleanupTenants() {
    for (const id of this.createdIds.tenants) {
      try {
        await this.deleteViaAPI('/api/tenants', id);
      } catch (error) {
        console.error(`Failed to delete tenant ${id}:`, error);
      }
    }
    this.createdIds.tenants = [];
  }

  private async cleanupServiceRequests() {
    for (const id of this.createdIds.serviceRequests) {
      try {
        await this.deleteViaAPI('/api/service_requests', id);
      } catch (error) {
        console.error(`Failed to delete service request ${id}:`, error);
      }
    }
    this.createdIds.serviceRequests = [];
  }

  private async cleanupLeases() {
    for (const id of this.createdIds.leases) {
      try {
        await this.deleteViaAPI('/api/leases', id);
      } catch (error) {
        console.error(`Failed to delete lease ${id}:`, error);
      }
    }
    this.createdIds.leases = [];
  }

  private async cleanupDocuments() {
    for (const id of this.createdIds.documents) {
      try {
        await this.deleteViaAPI('/api/documents', id);
      } catch (error) {
        console.error(`Failed to delete document ${id}:`, error);
      }
    }
    this.createdIds.documents = [];
  }

  private async deleteViaAPI(endpoint: string, id: string) {
    const response = await this.page.request.delete(`${endpoint}/${id}`);
    if (!response.ok()) {
      throw new Error(`Failed to delete ${endpoint}/${id}: ${response.status()}`);
    }
  }

  async resetDatabase() {
    // This would typically call a test endpoint to reset the database
    // Only available in test environments
    if (process.env.NODE_ENV === 'test') {
      const response = await this.page.request.post('/api/test/reset-database');
      if (!response.ok()) {
        throw new Error('Failed to reset database');
      }
    }
  }

  async seedTestData() {
    // Seed with known test data for consistent testing
    if (process.env.NODE_ENV === 'test') {
      const response = await this.page.request.post('/api/test/seed-data');
      if (!response.ok()) {
        throw new Error('Failed to seed test data');
      }
      return await response.json();
    }
  }
}