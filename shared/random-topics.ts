export const topicCategories = {
  "Artificial Intelligence & Machine Learning": [
    "Deep Learning for Natural Language Processing",
    "Reinforcement Learning in Autonomous Systems",
    "Explainable AI and Model Interpretability",
    "Federated Learning for Privacy-Preserving ML",
    "Generative AI and Large Language Models",
    "Computer Vision for Medical Imaging",
    "AI Ethics and Bias Mitigation",
    "Neural Architecture Search and AutoML",
  ],
  "Software Engineering & Development": [
    "Microservices Architecture and Design Patterns",
    "DevOps and Continuous Integration/Deployment",
    "Cloud-Native Application Development",
    "Test-Driven Development Best Practices",
    "Code Quality and Technical Debt Management",
    "API Design and RESTful Architecture",
    "Containerization and Orchestration with Kubernetes",
    "Serverless Computing and Function-as-a-Service",
  ],
  "Cybersecurity & Privacy": [
    "Zero Trust Security Architecture",
    "Blockchain for Secure Data Management",
    "Privacy-Preserving Technologies and Differential Privacy",
    "Network Security and Intrusion Detection Systems",
    "Cryptography and Encryption Standards",
    "Security in IoT Devices and Networks",
    "Penetration Testing and Vulnerability Assessment",
    "Identity and Access Management Solutions",
  ],
  "Data Science & Analytics": [
    "Big Data Processing with Apache Spark",
    "Time Series Analysis and Forecasting",
    "A/B Testing and Experimental Design",
    "Data Visualization Best Practices",
    "Predictive Analytics for Business Intelligence",
    "Data Warehousing and ETL Processes",
    "Real-Time Stream Processing",
    "Data Governance and Quality Management",
  ],
  "Cloud Computing & Infrastructure": [
    "Multi-Cloud Strategy and Management",
    "Edge Computing and Fog Computing",
    "Cloud Cost Optimization Strategies",
    "Infrastructure as Code with Terraform",
    "Cloud Security and Compliance",
    "Hybrid Cloud Architecture",
    "Cloud Migration Best Practices",
    "Serverless Architecture Patterns",
  ],
  "Internet of Things & Embedded Systems": [
    "Smart Home Automation Systems",
    "Industrial IoT and Industry 4.0",
    "Low-Power Wide-Area Networks for IoT",
    "IoT Data Analytics and Edge Intelligence",
    "Wearable Technology and Health Monitoring",
    "Smart City Infrastructure",
    "IoT Security Challenges and Solutions",
    "Sensor Networks and Data Collection",
  ],
  "Web Technologies & User Experience": [
    "Progressive Web Applications Development",
    "Single Page Application Architecture",
    "Web Performance Optimization",
    "Accessibility in Web Design (WCAG Compliance)",
    "Responsive Design and Mobile-First Approach",
    "Web Components and Modern Framework Comparison",
    "User Interface Design Patterns",
    "Web3 and Decentralized Applications",
  ],
  "Emerging Technologies": [
    "Quantum Computing Applications",
    "Augmented Reality and Virtual Reality",
    "5G Networks and Mobile Technology",
    "Digital Twins in Manufacturing",
    "Brain-Computer Interfaces",
    "Autonomous Vehicles and Transportation",
    "Robotics and Automation",
    "Green Technology and Sustainable Computing",
  ],
};

export function getRandomTopic(): { topic: string; category: string } {
  const categories = Object.keys(topicCategories);
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const topics = topicCategories[randomCategory as keyof typeof topicCategories];
  const randomTopic = topics[Math.floor(Math.random() * topics.length)];
  
  return {
    topic: randomTopic,
    category: randomCategory,
  };
}
