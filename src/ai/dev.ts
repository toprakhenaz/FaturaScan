import { config } from 'dotenv';
config();

import '@/ai/flows/extract-invoice-data.ts';
import '@/ai/flows/validate-extracted-data.ts';