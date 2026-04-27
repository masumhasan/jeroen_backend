const mongoose = require('mongoose');

const APP_CONTENT_TYPES = ['about-us', 'privacy-policy', 'terms-and-conditions'];

const DEFAULT_CONTENT_BY_TYPE = {
  'about-us': `<p>Welcome to RobbyWork! We are a dedicated team committed to building powerful tools that help businesses and individuals manage their data effectively.</p><p>Our mission is to provide intuitive, reliable, and secure solutions that empower users to take full control of their information. Founded in 2020, we have grown to serve thousands of customers worldwide.</p><p>We believe in transparency, innovation, and putting our users first. Our platform is continuously evolving to meet the needs of a rapidly changing digital landscape.</p><p>If you have any questions or feedback, feel free to reach out to our support team at support@robbywork.com.</p>`,
  'privacy-policy': `<p>Privacy Policy - Last updated: January 1, 2025</p><p>At RobbyWork, we take your privacy seriously. This policy outlines how we collect, use, and protect your personal information.</p><p>1. Information We Collect: We collect information you provide directly to us, such as your name, email address, and usage data when you interact with our platform.</p><p>2. How We Use Your Information: We use the information we collect to provide, maintain, and improve our services, communicate with you, and ensure platform security.</p><p>3. Data Sharing: We do not sell or share your personal data with third parties except as necessary to provide our services or as required by law.</p><p>4. Data Security: We implement industry-standard security measures to protect your information from unauthorized access or disclosure.</p><p>5. Contact Us: If you have questions about this policy, contact us at privacy@robbywork.com.</p>`,
  'terms-and-conditions': `<p>Terms and Conditions - Last updated: January 1, 2025</p><p>By accessing or using RobbyWork, you agree to be bound by these Terms and Conditions.</p><p>1. Acceptance of Terms: By using our platform, you confirm that you are at least 18 years of age and agree to comply with these terms.</p><p>2. Use of Service: You agree to use RobbyWork only for lawful purposes and in a manner that does not infringe the rights of others.</p><p>3. Account Responsibility: You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p><p>4. Intellectual Property: All content, trademarks, and data on this platform are the property of RobbyWork and may not be reproduced without permission.</p><p>5. Termination: We reserve the right to suspend or terminate your access to the platform at our discretion if you violate these terms.</p><p>6. Contact: For questions regarding these terms, contact us at legal@robbywork.com.</p>`,
};

const appContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: APP_CONTENT_TYPES,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      default: '',
    },
  },
  { timestamps: true },
);

const AppContent = mongoose.model('AppContent', appContentSchema);

module.exports = {
  AppContent,
  APP_CONTENT_TYPES,
  DEFAULT_CONTENT_BY_TYPE,
};
