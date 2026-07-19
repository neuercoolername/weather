-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Location" (
    "id" SERIAL NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherSnapshot" (
    "id" SERIAL NOT NULL,
    "locationId" INTEGER NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "precipitation" DOUBLE PRECISION NOT NULL,
    "windspeed" DOUBLE PRECISION NOT NULL,
    "weathercode" INTEGER NOT NULL,
    "isDay" BOOLEAN NOT NULL,
    "rawJson" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TracePoint" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TracePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intersection" (
    "id" SERIAL NOT NULL,
    "tracePointIdA" INTEGER NOT NULL,
    "tracePointIdB" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "text" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intersection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntersectionImage" (
    "id" TEXT NOT NULL,
    "intersectionId" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntersectionImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TracePoint_snapshotId_key" ON "TracePoint"("snapshotId");

-- CreateIndex
CREATE INDEX "IntersectionImage_intersectionId_idx" ON "IntersectionImage"("intersectionId");

-- AddForeignKey
ALTER TABLE "WeatherSnapshot" ADD CONSTRAINT "WeatherSnapshot_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TracePoint" ADD CONSTRAINT "TracePoint_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "WeatherSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intersection" ADD CONSTRAINT "Intersection_tracePointIdA_fkey" FOREIGN KEY ("tracePointIdA") REFERENCES "TracePoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intersection" ADD CONSTRAINT "Intersection_tracePointIdB_fkey" FOREIGN KEY ("tracePointIdB") REFERENCES "TracePoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntersectionImage" ADD CONSTRAINT "IntersectionImage_intersectionId_fkey" FOREIGN KEY ("intersectionId") REFERENCES "Intersection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

