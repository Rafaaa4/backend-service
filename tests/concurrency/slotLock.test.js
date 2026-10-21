import { connectDatabase, disconnectDatabase } from '../../src/config/database.js';
import { User } from '../../src/modules/users/user.model.js';
import { Category } from '../../src/modules/categories/category.model.js';
import { Service } from '../../src/modules/services/service.model.js';
import { ProviderProfile } from '../../src/modules/providers/provider.model.js';
import { SlotLock } from '../../src/modules/bookings/slotLock.model.js';
import { Booking } from '../../src/modules/bookings/booking.model.js';
import { BookingsService } from '../../src/modules/bookings/bookings.service.js';

describe('Concurrency & Zero Double-Booking Stress Test', () => {
  let providerUser;
  let clientUser;
  let testService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    await connectDatabase();

    // Clean test state
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Service.deleteMany({}),
      ProviderProfile.deleteMany({}),
      SlotLock.deleteMany({}),
      Booking.deleteMany({})
    ]);

    // Create Category & Service
    const cat = await Category.create({ name: 'Plomberie', slug: 'plomberie' });
    testService = await Service.create({
      categoryId: cat._id,
      name: 'Réparation Fuite',
      basePrice: 50000,
      depositPercentage: 20,
      estimatedDurationMinutes: 60
    });

    // Create Verified Provider
    providerUser = await User.create({
      email: 'concurrent.provider@test.tn',
      passwordHash: 'hash',
      fullName: 'Provider Concurrency'
    });

    await ProviderProfile.create({
      userId: providerUser._id,
      businessName: 'Rapid Plombier',
      verificationStatus: 'VERIFIED',
      categoryIds: [cat._id],
      serviceIds: [testService._id]
    });

    // Create Client
    clientUser = await User.create({
      email: 'concurrent.client@test.tn',
      passwordHash: 'hash',
      fullName: 'Client Concurrency'
    });
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  test('50 concurrent booking attempts for the EXACT same slot results in strictly 1 success and 49 conflicts (409)', async () => {
    const slotStart = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    // Round to nearest hour
    slotStart.setMinutes(0, 0, 0);

    const CONCURRENT_REQUESTS = 50;

    // Fire all requests simultaneously
    const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, idx) => {
      return BookingsService.createBooking({
        clientId: clientUser._id,
        providerId: providerUser._id,
        serviceId: testService._id,
        startAt: slotStart.toISOString(),
        address: { street: `Avenue Concurrency #${idx}` }
      })
        .then(booking => ({ status: 'SUCCESS', booking }))
        .catch(err => ({ status: 'FAILED', code: err.code, message: err.message }));
    });

    const results = await Promise.all(promises);

    const successes = results.filter(r => r.status === 'SUCCESS');
    const failures = results.filter(r => r.status === 'FAILED');

    // STRICT ATOMIC GUARANTEE:
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(CONCURRENT_REQUESTS - 1);

    // Verify all failures have SLOT_UNAVAILABLE code
    for (const fail of failures) {
      expect(fail.code).toBe('SLOT_UNAVAILABLE');
    }

    // Verify database state: exactly 1 booking in database
    const totalBookings = await Booking.countDocuments({ providerId: providerUser._id });
    expect(totalBookings).toBe(1);

    // Verify database state: SlotLock exists and has state HELD
    const locks = await SlotLock.find({ providerId: providerUser._id });
    expect(locks.length).toBeGreaterThan(0);
    expect(locks[0].state).toBe('HELD');
  });
});
