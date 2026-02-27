import { DependencyChange } from "./parsers";

/** Semver upgrade classification */
export type UpgradeType = "major" | "minor" | "patch" | "unknown";

/** Risk level for impact assessment */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** A dependency change enriched with upgrade classification and release notes */
export interface EnrichedDependencyChange extends DependencyChange {
  upgradeType: UpgradeType;
  releaseNotes: string | null;
}

/** Output of Step 1: breaking change extraction per dependency */
export interface BreakingChangeEntry {
  dependency: string;
  upgradeType: UpgradeType;
  breakingChanges: string[];
  deprecations: string[];
  notableChanges: string[];
  hasConfirmedBreakingChanges: boolean;
}

export interface Step1Result {
  dependencies: BreakingChangeEntry[];
}

/** Output of Step 2: cross-reference of breaking changes with codebase usage */
export interface UsageImpact {
  dependency: string;
  change: string;
  affectedFiles: string[];
  affectedCode: string[];
  requiredAction: string;
  severity: RiskLevel;
}

export interface Step2Result {
  impacts: UsageImpact[];
  unaffectedUsages: Array<{
    dependency: string;
    fileCount: number;
  }>;
}

/** Output of Step 3: final synthesized assessment */
export interface DependencyAssessment {
  overallRisk: RiskLevel;
  riskJustification: string;
  dependencySummaries: Array<{
    dependency: string;
    fromVersion: string;
    toVersion: string;
    upgradeType: UpgradeType;
    risk: RiskLevel;
    oneLiner: string;
  }>;
  actionItems: Array<{
    severity: RiskLevel;
    dependency: string;
    file: string;
    description: string;
  }>;
  inlineAnnotations: Array<{
    dependency: string;
    annotation: string;
  }>;
  narrativeSummary: string;
}
