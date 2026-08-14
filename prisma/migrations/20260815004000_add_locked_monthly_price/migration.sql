ALTER TABLE `User`
  ADD COLUMN `lockedMonthlyPrice` DOUBLE NULL,
  ADD COLUMN `priceLockedAt` DATETIME(3) NULL;
