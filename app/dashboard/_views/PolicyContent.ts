
export interface PolicySection {
	title: string;
	content: string[];
}

export interface Policy {
	id: string;
	title: string;
	sections: PolicySection[];
}

export const POLICIES: Policy[] = [
	{
		id: 'terms',
		title: 'Terms of Use',
		sections: [
			{
				title: '1. Acceptance of Terms',
				content: [
					'By accessing Sauti Salama, you agree to be bound by these Terms of Use, all applicable laws and regulations in Kenya (including the Constitution of Kenya 2010), and international human rights standards.',
					'These terms constitute a legally binding agreement between you and Sauti Salama regarding your use of the platform and its associated services.'
				]
			},
			{
				title: '2. Purpose of the Platform',
				content: [
					'Sauti Salama is designed to provide a safe, secure, and confidential environment for survivors of Gender-Based Violence (GBV) to report incidents and connect with support services.',
					'Any misuse of the platform for harassment, false reporting, or illegal activities is strictly prohibited and may result in legal action under the Computer Misuse and Cybercrimes Act (2018).'
				]
			},
			{
				title: '3. User Responsibility',
				content: [
					'Users are responsible for maintaining the confidentiality of their account credentials, especially for anonymous sessions which rely on secure key management.',
					'You agree to notify Sauti Salama immediately of any unauthorized use of your account or any other breach of security.'
				]
			}
		]
	},
	{
		id: 'privacy',
		title: 'Privacy & Data Protection Policy',
		sections: [
			{
				title: '1. Data Collection & Kenyan Law',
				content: [
					'In accordance with the Kenyan Data Protection Act (2019) and international GDPR standards, Sauti Salama collects only the minimal data necessary to provide support services.',
					'Personal data is processed based on your explicit consent and for the purposes of protecting your vital interests as a survivor.'
				]
			},
			{
				title: '2. Confidentiality',
				content: [
					'Survivor identities are protected with end-to-end encryption. Information shared with service providers is strictly on a "need-to-know" basis and requires your secondary consent for referrals.',
					'Anonymous reporting does not store IP addresses or browser fingerprints that could be used for de-anonymization, ensuring absolute privacy for those in high-risk situations.'
				]
			},
			{
				title: '3. Data Subject Rights',
				content: [
					'Under the Data Protection Act, you have the right to access your personal data, correct inaccuracies, or request the erasure of your data ("Right to be Forgotten").',
					'You may also object to the processing of your data or request to port your data to another service.'
				]
			}
		]
	},
	{
		id: 'survivor_safety',
		title: 'Survivor Safety & Confidentiality Agreement',
		sections: [
			{
				title: '1. Privacy First',
				content: [
					'We prioritize your physical and digital safety above all else. Information shared in your reports is encrypted and only accessible to the specific professionals or organisations you choose to engage with.',
					'No information is shared with law enforcement or state agencies without your explicit request or a mandatory court order.'
				]
			},
			{
				title: '2. Mandatory Reporting',
				content: [
					'While we maintain strict confidentiality, please be aware that under the Sexual Offences Act (Kenya) and Children Act (Kenya), certain disclosures—especially those involving the immediate danger of a minor—may require reporting to relevant legal authorities to ensure immediate safety.',
					'Our experts are trained to handle such situations with the utmost sensitivity and will involve you in the process wherever safe to do so.'
				]
			},
			{
				title: '3. Secure Communication',
				content: [
					'Always use the platforms secure, encrypted chat for communicating with experts. Avoid sharing sensitive information via external, unencrypted channels like SMS or non-secure messaging apps.',
					'Be mindful of your device security; we recommend using "Incognito" or private browsing modes when accessing the platform from shared devices.'
				]
			}
		]
	},
	{
		id: 'professional_conduct',
		title: 'Professional Code of Conduct',
		sections: [
			{
				title: '1. Ethical Standards',
				content: [
					'Professionals and Organisations must adhere to the highest ethical and professional standards of their respective fields (Legal, Medical, Psychological).',
					'You must maintain the principle of "Do No Harm" at all times when interacting with survivors.'
				]
			},
			{
				title: '2. Response Timelines',
				content: [
					'You agree to respond to matches and inquiries within a reasonable timeframe (ideally within 24-48 hours) to ensure survivors receive timely support during critical windows.',
					'Failure to maintain active engagement may result in your services being de-prioritized or suspended.'
				]
			},
			{
				title: '3. Prohibition of Retaliation',
				content: [
					'Any form of retaliation, exploitation, or further victimization of survivors is strictly prohibited.',
					'Such actions are grounds for immediate permanent suspension and criminal referral to the National Police Service and relevant professional regulatory boards (e.g., LSK, KMPDC).'
				]
			}
		]
	},
	{
		id: 'referral_policy',
		title: 'Data Sharing & Referral Policy',
		sections: [
			{
				title: '1. Consent-Based Referrals',
				content: [
					'Referrals between organisations must be based on explicit survivor consent for each specific referral path.',
					'No case data shall be shared with third parties without high-level encryption and clear digital audit trails.'
				]
			},
			{
				title: '2. Accountability',
				content: [
					'Organisations are responsible for the actions and data access of their individual staff members on the platform.',
					'Regular audits of data access logs will be conducted by Sauti Salama administrators to ensure compliance with the Data Protection Act.'
				]
			}
		]
	}
];
