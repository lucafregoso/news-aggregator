-- CreateTable
CREATE TABLE "SummaryJob" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "topics" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "currentTopic" INTEGER NOT NULL DEFAULT 0,
    "totalTopics" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SummaryJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SummaryJob_status_idx" ON "SummaryJob"("status");

-- CreateIndex
CREATE INDEX "SummaryJob_createdAt_idx" ON "SummaryJob"("createdAt");

-- CreateIndex
CREATE INDEX "Summary_startDate_endDate_idx" ON "Summary"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Summary_generatedAt_idx" ON "Summary"("generatedAt");
