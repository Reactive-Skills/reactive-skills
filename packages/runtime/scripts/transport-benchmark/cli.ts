import './network-fence.mjs';
import { runBenchmark } from './run.js';

// JSON goes to stdout. Redirect it to a proof directory outside the repository.
process.stdout.write(JSON.stringify(await runBenchmark(), null, 2) + '\n');
