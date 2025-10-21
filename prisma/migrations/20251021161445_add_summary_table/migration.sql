-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "topics" JSONB NOT NULL,
    "totalArticles" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "articleIds" TEXT[],
    "queryTopics" TEXT[],

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);
