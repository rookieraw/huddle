import { CHAT_PRISMA_CLIENT } from '@huddle/chat';
import { AUTHENTICATION_API, DIRECTORY_API } from '@huddle/identity';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

type ContactRequestSuccessBody = {
  id: string;
  requesterId: string;
  recipientId: string;
  status: string;
};

describe('Contact requests (e2e)', () => {
  let app: INestApplication<App>;

  const verifyAccessToken = jest.fn();
  const userExists = jest.fn();
  const findFirst = jest.fn();
  const upsert = jest.fn();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTHENTICATION_API)
      .useValue({ verifyAccessToken })
      .overrideProvider(DIRECTORY_API)
      .useValue({ userExists })
      .overrideProvider(CHAT_PRISMA_CLIENT)
      .useValue({
        contactRelationship: {
          findFirst,
          upsert,
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(() => {
    verifyAccessToken.mockReset().mockResolvedValue({
      userId: 'user-requester',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    userExists.mockReset().mockResolvedValue(true);
    findFirst.mockReset().mockResolvedValue(null);
    upsert.mockReset().mockResolvedValue({
      id: 'relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a pending relationship through the authenticated HTTP route', async () => {
    const response = await request(app.getHttpServer())
      .post('/contact-requests')
      .set('Authorization', 'Bearer access-token')
      .send({ targetUserId: 'user-target' })
      .expect(200);
    const body = response.body as ContactRequestSuccessBody;

    expect(body).toEqual({
      id: 'relationship-id',
      requesterId: 'user-requester',
      recipientId: 'user-target',
      status: 'pending',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('access-token');
    expect(userExists).toHaveBeenCalledWith('user-target');
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
