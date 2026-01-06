import { EvaluationWizard } from '@/components/evaluation/EvaluationWizard';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Performance Self-Evaluation | Bunting PEP</title>
        <meta name="description" content="Complete your annual performance self-evaluation for salaried employees. Rate your achievements, set goals, and submit for review." />
      </Helmet>
      <EvaluationWizard />
    </>
  );
};

export default Index;
