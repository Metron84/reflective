import TrainingHero from "@/components/training/TrainingHero";
import TrainingSyllabus from "@/components/training/TrainingSyllabus";
import TrainingOutcomes from "@/components/training/TrainingOutcomes";
import TrainingApplyBand from "@/components/training/TrainingApplyBand";
import TrainingProof from "@/components/training/TrainingProof";
import TrainingStanding from "@/components/training/TrainingStanding";
import TrainingCommitment from "@/components/training/TrainingCommitment";
import TrainingApply from "@/components/training/TrainingApply";
import TrainingStickyCta from "@/components/training/TrainingStickyCta";
import { SITE_URL, TRAINING_ENABLED } from "@/lib/config";
import { EPISODE_ZERO_THUMB } from "@/lib/training-media";

const TITLE = "Media Training in Dubai | The Reflective Football";
const DESCRIPTION =
  "A practical one-month media course in Dubai covering interviewing, filming, editing and social media. Four seats per cohort.";
const OG_IMAGE = `${SITE_URL}${EPISODE_ZERO_THUMB}`;

export const metadata = {
  title: {
    absolute: TITLE,
  },
  description: DESCRIPTION,
  alternates: {
    canonical: "/training",
  },
  robots: TRAINING_ENABLED ? undefined : { index: false, follow: false },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/training`,
    type: "website",
    images: [
      {
        url: OG_IMAGE,
        width: 1024,
        height: 576,
        alt: "We Are Football, Episode Zero",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function TrainingPage() {
  return (
    <>
      <TrainingHero />
      <TrainingSyllabus />
      <TrainingOutcomes />
      <TrainingApplyBand />
      <TrainingProof />
      <TrainingStanding />
      <TrainingCommitment />
      <TrainingApply />
      <TrainingStickyCta />
    </>
  );
}
