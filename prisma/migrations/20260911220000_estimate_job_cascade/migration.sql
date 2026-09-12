-- DropForeignKey
ALTER TABLE "Estimate" DROP CONSTRAINT "Estimate_jobId_fkey";

-- AddForeignKey
ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
