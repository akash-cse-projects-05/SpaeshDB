require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('./src/models/Article');
const connectDB = require('./src/config/db');

const blogs = [
  {
    title: 'Understanding PrEP: Your Daily Shield Against HIV',
    slug: 'understanding-prep-daily-shield',
    summary: 'Pre-Exposure Prophylaxis (PrEP) is a highly effective medication for preventing HIV. Learn how it works, who should take it, and what to expect.',
    content: `<h2>What is PrEP?</h2>
<p>Pre-Exposure Prophylaxis (PrEP) is a daily medication that significantly reduces the risk of acquiring HIV from sex or injection drug use. When taken as prescribed, PrEP is highly effective at preventing HIV.</p>
<h2>How effective is it?</h2>
<p>Studies have shown that PrEP reduces the risk of getting HIV from sex by about 99% when taken consistently. Among people who inject drugs, PrEP reduces the risk by at least 74%.</p>
<h2>Is PrEP right for me?</h2>
<p>If you do not have HIV and are at high risk of exposure through sexual activity or drug injection, PrEP might be right for you. Speak to one of our clinical practitioners today to get an assessment.</p>`,
    author: 'Dr. Vikram Sen, MD',
    category: 'PrEP'
  },
  {
    title: 'PEP: The 72-Hour Window for HIV Prevention',
    slug: 'pep-72-hour-window',
    summary: 'Post-Exposure Prophylaxis (PEP) must be taken within 72 hours of potential exposure to HIV. Discover the critical steps to take in an emergency.',
    content: `<h2>What is PEP?</h2>
<p>Post-Exposure Prophylaxis (PEP) involves taking antiretroviral medicines (ART) after being potentially exposed to HIV to prevent becoming infected. PEP must be started within 72 hours after a recent possible exposure to HIV.</p>
<h2>When should PEP be used?</h2>
<ul>
  <li>If you think you may have been exposed to HIV during sex.</li>
  <li>If you shared needles and works to prepare drugs.</li>
  <li>If you were sexually assaulted.</li>
</ul>
<p>Every hour counts. If you believe you have been exposed, contact our emergency telehealth line immediately to get a prescription.</p>`,
    author: 'Dr. Sarah Jenkins',
    category: 'PEP'
  },
  {
    title: 'Navigating Stigma: Mental Health and HIV',
    slug: 'navigating-stigma-mental-health',
    summary: 'Living with or testing for HIV can be emotionally taxing due to societal stigma. Here are strategies for protecting your mental well-being.',
    content: `<h2>The Psychological Impact</h2>
<p>Fear of stigma can prevent people from getting tested and treated for HIV. It is important to recognize that HIV is a manageable chronic condition, not a moral failing.</p>
<h2>How to Protect Your Mental Health</h2>
<p>Building a support system is crucial. This can include understanding friends, family, and professional counselors. SPARSH offers anonymous consultation services so you can seek help without fear of exposure or judgment.</p>
<h2>Moving Forward</h2>
<p>Your health is your priority. Don't let societal misunderstandings dictate your healthcare decisions. Reach out to our specialists to learn how to manage anxiety related to testing and treatment.</p>`,
    author: 'Dr. Emily Chen, PhD',
    category: 'General Health'
  }
];

async function seed() {
  await connectDB();
  for (const blog of blogs) {
    try {
      await Article.findOneAndUpdate({ slug: blog.slug }, blog, { upsert: true, new: true });
      console.log(`Seeded: ${blog.title}`);
    } catch (err) {
      console.error(`Error seeding ${blog.title}:`, err);
    }
  }
  process.exit(0);
}
seed();
