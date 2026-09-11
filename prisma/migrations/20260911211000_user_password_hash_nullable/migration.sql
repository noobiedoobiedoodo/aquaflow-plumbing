-- Make passwordHash nullable on User
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
