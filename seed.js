import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './src/config/database.js';
import { User } from './src/modules/users/user.model.js';
import { Category } from './src/modules/categories/category.model.js';
import { Service } from './src/modules/services/service.model.js';
import { ProviderProfile } from './src/modules/providers/provider.model.js';
import { AvailabilityRule } from './src/modules/availability/availability.model.js';
import { hashPassword } from './src/core/security/password.js';
import { logger } from './src/core/logger/index.js';

const seed = async () => {
  try {
    await connectDatabase();
    logger.info('Purging existing database collections for fresh seed...');

    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Service.deleteMany({}),
      ProviderProfile.deleteMany({}),
      AvailabilityRule.deleteMany({})
    ]);

    // 1. Create Superadmin
    const adminPasswordHash = await hashPassword('AdminPass123!');
    const adminUser = await User.create({
      email: 'admin@homeservices.tn',
      passwordHash: adminPasswordHash,
      fullName: 'Super Administrateur',
      role: 'superadmin',
      status: 'active',
      phone: '+21671000000',
      address: { city: 'Tunis', street: 'Avenue Habib Bourguiba' }
    });
    logger.info('Created Superadmin: admin@homeservices.tn');

    // 2. Create Categories
    const categoriesData = [
      { name: 'Maison & Réparation', slug: 'maison-reparation', icon: 'home_repair_service', order: 1, description: 'Électricité, plomberie, serrurerie, peinture, climatisation' },
      { name: 'Nettoyage & Entretien', slug: 'nettoyage-entretien', icon: 'cleaning_services', order: 2, description: 'Ménage à domicile, vitres, désinfection' },
      { name: 'Tech & Digital', slug: 'tech-digital', icon: 'devices', order: 3, description: 'Dépannage informatique, installation Wi-Fi, réparation TV' },
      { name: 'Jardin & Extérieur', slug: 'jardin-exterieur', icon: 'yard', order: 4, description: 'Tonte de pelouse, élagage, arrosage' },
      { name: 'Beauté & Bien-être', slug: 'beaute-bien-etre', icon: 'spa', order: 5, description: 'Coiffure, soins à domicile, massage relaxant' },
      { name: 'Services Personnels', slug: 'services-personnels', icon: 'person', order: 6, description: 'Garde d’enfants, aide aux seniors, cours particuliers' }
    ];

    const categories = await Category.insertMany(categoriesData);
    logger.info(`Inserted ${categories.length} categories`);

    const catMap = {};
    categories.forEach(c => { catMap[c.slug] = c._id; });

    // 3. Create Services
    const servicesData = [
      { categoryId: catMap['maison-reparation'], name: 'Dépannage Électrique d’urgence', description: 'Recherche de panne, disjoncteur, prises défectueuses', priceType: 'fixed', basePrice: 45000, depositPercentage: 20, estimatedDurationMinutes: 60 },
      { categoryId: catMap['maison-reparation'], name: 'Plomberie & Réparation de fuite', description: 'Réparation fuite d’eau, débouchage canalisation, robinetterie', priceType: 'fixed', basePrice: 40000, depositPercentage: 20, estimatedDurationMinutes: 60 },
      { categoryId: catMap['maison-reparation'], name: 'Installation & Entretien Climatiseur', description: 'Recharge gaz, nettoyage filtres, diagnostic', priceType: 'fixed', basePrice: 60000, depositPercentage: 25, estimatedDurationMinutes: 90 },
      { categoryId: catMap['nettoyage-entretien'], name: 'Ménage complet à domicile', description: 'Nettoyage sols, poussière, cuisine et sanitaires', priceType: 'hourly', basePrice: 20000, depositPercentage: 20, estimatedDurationMinutes: 120 },
      { categoryId: catMap['nettoyage-entretien'], name: 'Nettoyage Canapé & Tapis', description: 'Injection-extraction professionnelle pour tissus d’ameublement', priceType: 'fixed', basePrice: 75000, depositPercentage: 20, estimatedDurationMinutes: 90 },
      { categoryId: catMap['tech-digital'], name: 'Configuration Réseau Wi-Fi & Fibre', description: 'Optimisation couverture, répétiteurs, sécurisation réseau', priceType: 'fixed', basePrice: 50000, depositPercentage: 20, estimatedDurationMinutes: 60 }
    ];

    const services = await Service.insertMany(servicesData);
    logger.info(`Inserted ${services.length} services`);

    // 4. Create Verified Providers
    const providerPasswordHash = await hashPassword('ProviderPass123!');

    // Provider 1: Sami (Electricien)
    const samiUser = await User.create({
      email: 'sami.electricien@homeservices.tn',
      passwordHash: providerPasswordHash,
      fullName: 'Sami Ben Ali',
      role: 'provider',
      status: 'active',
      phone: '+21620111222',
      address: { city: 'Tunis', street: 'El Menzah 6', location: { type: 'Point', coordinates: [10.165, 36.835] } }
    });

    await ProviderProfile.create({
      userId: samiUser._id,
      businessName: 'Sami Électricité Pro',
      bio: 'Électricien certifié avec plus de 10 ans d’expérience en installations résidentielles et tertiaires à Tunis.',
      categoryIds: [catMap['maison-reparation']],
      serviceIds: [services[0]._id],
      verificationStatus: 'VERIFIED',
      location: { type: 'Point', coordinates: [10.165, 36.835] },
      serviceRadiusKm: 25,
      ratingAvg: 4.9,
      ratingCount: 38,
      hourlyRate: 35000,
      documents: [{ docType: 'id_card', fileUrl: 'https://storage.homeservices.tn/docs/sami_cin.pdf', status: 'APPROVED' }]
    });

    // Provider 2: Karim (Plombier)
    const karimUser = await User.create({
      email: 'karim.plombier@homeservices.tn',
      passwordHash: providerPasswordHash,
      fullName: 'Karim Trabelsi',
      role: 'provider',
      status: 'active',
      phone: '+21621333444',
      address: { city: 'Ariana', street: 'Ennasr 2', location: { type: 'Point', coordinates: [10.158, 36.852] } }
    });

    await ProviderProfile.create({
      userId: karimUser._id,
      businessName: 'Karim Plomberie Express',
      bio: 'Interventions rapides 7j/7 pour toutes vos urgences plomberie et sanitaires.',
      categoryIds: [catMap['maison-reparation']],
      serviceIds: [services[1]._id],
      verificationStatus: 'VERIFIED',
      location: { type: 'Point', coordinates: [10.158, 36.852] },
      serviceRadiusKm: 30,
      ratingAvg: 4.8,
      ratingCount: 24,
      hourlyRate: 30000,
      documents: [{ docType: 'id_card', fileUrl: 'https://storage.homeservices.tn/docs/karim_cin.pdf', status: 'APPROVED' }]
    });

    // Provider 3: Pending KYC
    const nizarUser = await User.create({
      email: 'nizar.peintre@homeservices.tn',
      passwordHash: providerPasswordHash,
      fullName: 'Nizar Mejrissi',
      role: 'provider',
      status: 'pending_verification',
      phone: '+21622555666',
      address: { city: 'Ben Arous', street: 'Megrine' }
    });

    await ProviderProfile.create({
      userId: nizarUser._id,
      businessName: 'Mejrissi Finitions',
      bio: 'Peintre en bâtiment et enduits décoratifs.',
      categoryIds: [catMap['maison-reparation']],
      verificationStatus: 'PENDING',
      documents: [{ docType: 'id_card', fileUrl: 'https://storage.homeservices.tn/docs/nizar_cin.pdf', status: 'PENDING' }]
    });

    // 5. Weekly availability schedules for providers
    const standardWeek = [1, 2, 3, 4, 5, 6].map(day => ({
      dayOfWeek: day,
      isEnabled: true,
      slots: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }]
    }));

    await AvailabilityRule.create({
      providerId: samiUser._id,
      slotDurationMinutes: 60,
      weeklySchedule: standardWeek
    });

    await AvailabilityRule.create({
      providerId: karimUser._id,
      slotDurationMinutes: 60,
      weeklySchedule: standardWeek
    });

    // 6. Test Client
    const clientPasswordHash = await hashPassword('ClientPass123!');
    const clientUser = await User.create({
      email: 'client@test.tn',
      passwordHash: clientPasswordHash,
      fullName: 'Mourad Ben Salah',
      role: 'client',
      status: 'active',
      phone: '+21698765432',
      address: { city: 'Tunis', street: 'Rue de Marseille', coordinates: [10.18, 36.80] }
    });
    logger.info('Created Test Client: client@test.tn');

    logger.info('🎉 SEED COMPLETED SUCCESSFULLY!');
    await disconnectDatabase();
    process.exit(0);
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, 'Seed failed');
    process.exit(1);
  }
};

seed();
