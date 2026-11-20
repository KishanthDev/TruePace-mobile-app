/**
 * TruePace — AI Coaching & Recovery Insights Engine
 * Provides post-run narrative analysis, fatigue onset detection, and recovery guidance.
 * Operates strictly asynchronously post-run with zero impact on real-time tracking.
 * 100% offline-capable via deterministic local heuristic coach, with optional cloud LLM enhancement.
 */

import type { RunSummary } from '../types/tracking';

export interface AiRunCoachingReport {
  summaryTitle: string;
  performanceCategory: 'recovery' | 'base_building' | 'tempo' | 'threshold' | 'interval';
  pacingEvaluation: {
    consistencyGrade: 'A' | 'B' | 'C' | 'D';
    pacingStrategy: 'even' | 'negative_split' | 'positive_split' | 'erratic';
    fatigueOnsetKilometer: number | null; // KM index where split slowed by > 8%
    observation: string;
  };
  recoveryAdvice: {
    recommendedRestHours: number;
    recommendedNextWorkout: string;
    hydrationNutritionTip: string;
  };
}

export class AiCoachingService {
  private static instance: AiCoachingService | null = null;

  public static getInstance(): AiCoachingService {
    if (!AiCoachingService.instance) {
      AiCoachingService.instance = new AiCoachingService();
    }
    return AiCoachingService.instance;
  }

  /**
   * Generates a deterministic, rule-based coaching report locally without network access.
   * Completely offline, instantaneous, and mathematically grounded in pacing data.
   */
  public generateLocalCoachingReport(run: RunSummary): AiRunCoachingReport {
    const splits = run.splits || [];
    const distanceKm = run.distanceMeters / 1000;
    const avgPace = run.avgPaceSecondsPerKm || 300;

    // 1. Determine Consistency Grade
    const score = run.consistencyScore ?? 80;
    let grade: 'A' | 'B' | 'C' | 'D' = 'B';
    if (score >= 90) grade = 'A';
    else if (score >= 75) grade = 'B';
    else if (score >= 60) grade = 'C';
    else grade = 'D';

    // 2. Identify Pacing Strategy and Fatigue Onset
    let strategy: 'even' | 'negative_split' | 'positive_split' | 'erratic' = 'even';
    let fatigueOnsetKm: number | null = null;

    if (splits.length >= 2) {
      if (run.isNegativeSplit) {
        strategy = 'negative_split';
      } else if (score < 65) {
        strategy = 'erratic';
      } else {
        // Check for positive split / fade
        const firstHalf = splits.slice(0, Math.floor(splits.length / 2));
        const secondHalf = splits.slice(Math.floor(splits.length / 2));
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        if (avgSecond > avgFirst + 3) {
          strategy = 'positive_split';
        }
      }

      // Detect fatigue onset: look for first split that degrades by > 8% from preceding average
      for (let i = 1; i < splits.length; i++) {
        const precedingAvg = splits.slice(0, i).reduce((a, b) => a + b, 0) / i;
        if (splits[i] > precedingAvg * 1.08) {
          fatigueOnsetKm = i + 1; // 1-indexed KM
          break;
        }
      }
    }

    // 3. Determine Performance Category
    let category: AiRunCoachingReport['performanceCategory'] = 'base_building';
    if (distanceKm < 4 && avgPace < 270) {
      category = 'interval';
    } else if (distanceKm >= 4 && avgPace < 300) {
      category = 'tempo';
    } else if (distanceKm >= 12) {
      category = 'threshold';
    } else if (avgPace > 360) {
      category = 'recovery';
    }

    // 4. Construct Narrative Observation
    let observation = '';
    let summaryTitle = '';

    if (strategy === 'negative_split') {
      summaryTitle = 'Masterclass in Negative Split Pacing';
      observation = `Exceptional pacing discipline. You accelerated into the second half of your run, finishing stronger than you started.`;
    } else if (strategy === 'even') {
      summaryTitle = 'Metronomic, Highly Controlled Effort';
      observation = `Solid baseline consistency with minimal split variance. Your energy distribution matched your aerobic capacity well.`;
    } else if (strategy === 'positive_split') {
      summaryTitle = fatigueOnsetKm
        ? `Early Surge with Fatigue at KM ${fatigueOnsetKm}`
        : 'Positive Split with Late Aerobic Fatigue';
      observation = fatigueOnsetKm
        ? `You opened fast, but pace began fading at kilometer ${fatigueOnsetKm}. Starting 10-15s/km more conservatively will extend endurance.`
        : `Pace tapered in the closing kilometers as glycogen stores depleted.`;
    } else {
      summaryTitle = 'Surging and Fluctuating Rhythm';
      observation = `Noticeable pace variance between splits. Try locking onto a rhythmic breathing cadence to smooth out mid-run accelerations.`;
    }

    // 5. Recovery Window Estimation
    let restHours = 24;
    let nextWorkout = 'Light 20-30 min recovery jog or brisk walk';

    if (distanceKm >= 21) {
      restHours = 48;
      nextWorkout = 'Full rest day, followed by gentle cross-training or mobility';
    } else if (distanceKm >= 10 || category === 'tempo') {
      restHours = 36;
      nextWorkout = 'Easy aerobic recovery run at conversational pace';
    } else if (category === 'recovery') {
      restHours = 18;
      nextWorkout = 'Standard base-building aerobic run';
    }

    return {
      summaryTitle,
      performanceCategory: category,
      pacingEvaluation: {
        consistencyGrade: grade,
        pacingStrategy: strategy,
        fatigueOnsetKilometer: fatigueOnsetKm,
        observation,
      },
      recoveryAdvice: {
        recommendedRestHours: restHours,
        recommendedNextWorkout: nextWorkout,
        hydrationNutritionTip:
          distanceKm >= 10
            ? 'Replenish electrolytes and ingest 20-30g of protein with carbohydrates within 45 minutes.'
            : 'Rehydrate with 500ml of water and stretch calves and hip flexors.',
      },
    };
  }

  /**
   * Requests enhanced AI insights from an optional external endpoint (if configured),
   * falling back gracefully to the deterministic local engine on error or timeout.
   */
  public async getCoachingReport(
    run: RunSummary,
    apiEndpoint?: string,
    apiKey?: string
  ): Promise<AiRunCoachingReport> {
    // If no endpoint or key is supplied, return the high-fidelity local report immediately
    if (!apiEndpoint || !apiKey) {
      return this.generateLocalCoachingReport(run);
    }

    const localFallback = this.generateLocalCoachingReport(run);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second safety timeout

      // Sanitized, anonymized payload — zero latitude/longitude coordinates
      const anonymizedPayload = {
        distanceKm: (run.distanceMeters / 1000).toFixed(2),
        durationMinutes: Math.round(run.durationSeconds / 60),
        avgPaceSecondsPerKm: run.avgPaceSecondsPerKm,
        splitsSeconds: run.splits || [],
        consistencyScore: run.consistencyScore,
        isNegativeSplit: run.isNegativeSplit,
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are TruePace Coach. Analyze running splits and return concise JSON conforming to AiRunCoachingReport.',
            },
            {
              role: 'user',
              content: JSON.stringify(anonymizedPayload),
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return localFallback;
      }

      const json = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        const parsed: AiRunCoachingReport = JSON.parse(content);
        if (parsed.summaryTitle && parsed.pacingEvaluation) {
          return parsed;
        }
      }
      return localFallback;
    } catch {
      // Graceful fallback: Network failure, timeout, or invalid response
      return localFallback;
    }
  }
}
