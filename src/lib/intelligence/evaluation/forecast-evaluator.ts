import { prisma } from '@/lib/db';
import { OperationalForecast } from '@prisma/client';

export interface EvaluationMetrics {
  maeMinutes: number;
  biasMinutes: number;
  precision: number;
  recall: number;
  f1: number;
  fpr: number;
  fnr: number;
  brierScore: number;
  totalEvaluated: number;
  insufficientData: number;
  invalidated: number;
}

export interface CalibrationBucket {
  range: string;
  count: number;
  actualLateRate: number;
  status: 'Good' | 'Excellent' | 'Slightly underconfident' | 'Overconfident' | 'Insufficient Data';
}

export class ForecastEvaluator {

  static async evaluateModel(organizationId: string, modelVersion: string): Promise<{
    metrics: EvaluationMetrics;
    calibration: CalibrationBucket[];
  }> {
    
    // 1. Fetch all forecasts for the model version
    const allForecasts = await prisma.operationalForecast.findMany({
      where: { organizationId, modelVersion },
      include: { job: { include: { appointment: true } } }
    });

    let evaluatedCount = 0;
    let insufficientCount = 0;
    let invalidatedCount = 0;

    let absoluteErrorSum = 0;
    let biasSum = 0;
    
    let truePositives = 0;
    let falsePositives = 0;
    let trueNegatives = 0;
    let falseNegatives = 0;

    let brierScoreSum = 0;

    const probabilityBuckets: Record<string, { total: number; actualLate: number }> = {
      '0-10%': { total: 0, actualLate: 0 },
      '10-20%': { total: 0, actualLate: 0 },
      '20-30%': { total: 0, actualLate: 0 },
      '30-40%': { total: 0, actualLate: 0 },
      '40-50%': { total: 0, actualLate: 0 },
      '50-60%': { total: 0, actualLate: 0 },
      '60-70%': { total: 0, actualLate: 0 },
      '70-80%': { total: 0, actualLate: 0 },
      '80-90%': { total: 0, actualLate: 0 },
      '90-100%': { total: 0, actualLate: 0 },
    };

    for (const forecast of allForecasts) {
      // Data Quality Check 1: Must have actual completion
      if (!forecast.actualCompletionAt || forecast.actualLate === null) {
        insufficientCount++;
        continue;
      }

      // Data Quality Check 2: Invalidated (e.g. Job cancelled)
      if (['CANCELLED', 'REJECTED'].includes(forecast.job.status)) {
        invalidatedCount++;
        continue;
      }

      evaluatedCount++;

      // Compute Errors (in minutes)
      const predictedEnd = forecast.predictedCompletionAt.getTime();
      const actualEnd = forecast.actualCompletionAt.getTime();
      
      const errorMinutes = (predictedEnd - actualEnd) / 60000;
      
      absoluteErrorSum += Math.abs(errorMinutes);
      biasSum += errorMinutes; // Predicted - Actual (Negative = Early, Positive = Late)

      // Classification Matrix
      // Predict late if probability >= 50%
      const predictedLate = forecast.lateProbability >= 0.5;
      const actuallyLate = forecast.actualLate;

      if (predictedLate && actuallyLate) truePositives++;
      if (predictedLate && !actuallyLate) falsePositives++;
      if (!predictedLate && !actuallyLate) trueNegatives++;
      if (!predictedLate && actuallyLate) falseNegatives++;

      // Brier Score
      const predictedProb = forecast.lateProbability;
      const actualOutcome = actuallyLate ? 1.0 : 0.0;
      brierScoreSum += Math.pow(predictedProb - actualOutcome, 2);

      // Calibration Buckets
      const bucketIndex = Math.min(Math.floor(predictedProb * 10), 9);
      const bucketKey = `${bucketIndex * 10}-${(bucketIndex + 1) * 10}%`;
      probabilityBuckets[bucketKey].total++;
      if (actuallyLate) probabilityBuckets[bucketKey].actualLate++;
    }

    // Guard against divide by zero
    const n = evaluatedCount > 0 ? evaluatedCount : 1;

    const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    
    const metrics: EvaluationMetrics = {
      maeMinutes: Math.round((absoluteErrorSum / n) * 10) / 10,
      biasMinutes: Math.round((biasSum / n) * 10) / 10,
      precision: Math.round(precision * 100),
      recall: Math.round(recall * 100),
      f1: precision + recall > 0 ? Math.round(2 * (precision * recall) / (precision + recall) * 100) : 0,
      fpr: falsePositives + trueNegatives > 0 ? Math.round((falsePositives / (falsePositives + trueNegatives)) * 100) : 0,
      fnr: falseNegatives + truePositives > 0 ? Math.round((falseNegatives / (falseNegatives + truePositives)) * 100) : 0,
      brierScore: Math.round((brierScoreSum / n) * 1000) / 1000,
      totalEvaluated: evaluatedCount,
      insufficientData: insufficientCount,
      invalidated: invalidatedCount
    };

    // Construct Calibration Table
    const calibration: CalibrationBucket[] = Object.entries(probabilityBuckets).map(([range, data]) => {
      if (data.total < 5) return { range, count: data.total, actualLateRate: 0, status: 'Insufficient Data' };
      
      const actualRate = data.actualLate / data.total;
      const midPoint = (parseInt(range.split('-')[0]) + 5) / 100;
      
      const diff = Math.abs(actualRate - midPoint);
      let status: CalibrationBucket['status'] = 'Good';
      
      if (diff <= 0.05) status = 'Excellent';
      else if (diff <= 0.15) status = 'Good';
      else if (actualRate > midPoint) status = 'Slightly underconfident';
      else status = 'Overconfident';

      return {
        range,
        count: data.total,
        actualLateRate: Math.round(actualRate * 100),
        status
      };
    });

    return { metrics, calibration };
  }
}
