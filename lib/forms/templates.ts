import type { FormSettings, Question } from './schema';

/**
 * Ready-made forms, the way post templates give ready-made wording. Each one is a complete starting point:
 * title, intro, questions and sensible settings. Questions get fresh ids when a form is made from them.
 */
export interface FormTemplate {
  id: string;
  name: string;
  blurb: string;
  title: string;
  description: string;
  /** A short badge on the card. */
  kind: 'Consent' | 'Application' | 'Feedback' | 'Registration' | 'Survey';
  questions: Omit<Question, 'id'>[];
  settings?: Partial<FormSettings>;
}

const q = (label: string, type: Question['type'], extra: Partial<Omit<Question, 'id' | 'label' | 'type'>> = {}): Omit<Question, 'id'> => ({ label, type, required: false, ...extra });

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'media-consent',
    name: 'Media consent',
    kind: 'Consent',
    blurb: 'Permission to use photos, video, voice or a story, with clear choices about how.',
    title: 'Media consent form',
    description: 'We would like your permission to share photos, video, recordings or words from you. You decide what is shared and where. You can change your mind at any time by contacting us.',
    questions: [
      q('Full name', 'short', { required: true }),
      q('Email address', 'email', { required: true }),
      q('Phone number', 'short', { help: 'Optional. Only used if we need to confirm something with you.' }),
      q('What may we use?', 'checkbox', { required: true, options: ['Photographs', 'Video', 'Audio recordings', 'My written words or quotes', 'My story'] }),
      q('Where may it be shared?', 'checkbox', { required: true, options: ['Our website', 'Social media', 'Reports to funders and partners', 'Printed materials', 'News media'] }),
      q('How should we name you?', 'choice', { required: true, options: ['Use my full name', 'Use my first name only', 'Do not name me, keep me anonymous'] }),
      q('Is the person in the media under 18?', 'choice', { required: true, options: ['No', 'Yes, I am their parent or guardian'] }),
      q('Anything we should avoid showing or saying?', 'paragraph'),
      q('I understand how my media will be used and I agree', 'checkbox', { required: true, options: ['I agree'] }),
      q('Date', 'date', { required: true }),
    ],
    settings: { confirmation: 'Thank you. Your consent has been recorded. You can change your mind at any time by contacting us.', collectEmail: false },
  },
  {
    id: 'application',
    name: 'Application form',
    kind: 'Application',
    blurb: 'For roles, fellowships, grants, internships or programme places.',
    title: 'Application form',
    description: 'Thank you for your interest. Please answer each question as fully as you can. We read every application.',
    questions: [
      q('Full name', 'short', { required: true }),
      q('Email address', 'email', { required: true }),
      q('Phone number', 'short', { required: true }),
      q('County or town where you live', 'short'),
      q('What are you applying for?', 'dropdown', { required: true, options: ['Role 1', 'Role 2', 'Programme place', 'Other'] }),
      q('Why are you interested in this?', 'paragraph', { required: true }),
      q('Tell us about your relevant experience', 'paragraph', { required: true }),
      q('How many years of related experience do you have?', 'number'),
      q('How did you hear about this opportunity?', 'choice', { options: ['Social media', 'A friend or colleague', 'Our website', 'Email', 'Other'], allowOther: true }),
      q('Link to your CV, portfolio or profile', 'short', { help: 'A link to a shared document, or your LinkedIn page.' }),
      q('When could you start?', 'date'),
      q('Is there anything we should know to support you?', 'paragraph'),
    ],
    settings: { confirmation: 'Thank you for applying. We will be in touch by email.', collectEmail: false },
  },
  {
    id: 'feedback',
    name: 'Feedback',
    kind: 'Feedback',
    blurb: 'How did it go? A short form to learn what worked and what to improve.',
    title: 'Your feedback',
    description: 'Your honest answers help us improve. This takes about two minutes.',
    questions: [
      q('How would you rate your experience overall?', 'scale', { required: true, scale: { min: 1, max: 5, minLabel: 'Poor', maxLabel: 'Excellent' } }),
      q('How easy was it to reach us or take part?', 'scale', { scale: { min: 1, max: 5, minLabel: 'Very hard', maxLabel: 'Very easy' } }),
      q('Did you feel respected and listened to?', 'choice', { options: ['Always', 'Mostly', 'Sometimes', 'Rarely'] }),
      q('What worked well?', 'paragraph'),
      q('What should we do better?', 'paragraph'),
      q('Would you recommend us to someone who needed this?', 'choice', { options: ['Yes', 'Maybe', 'No'] }),
      q('May we contact you about your feedback?', 'choice', { options: ['Yes', 'No'] }),
      q('Email address', 'email', { help: 'Only if you said yes above.' }),
    ],
    settings: { confirmation: 'Thank you. Your feedback has been recorded.' },
  },
  {
    id: 'event-registration',
    name: 'Event registration',
    kind: 'Registration',
    blurb: 'Sign-ups for a workshop, training or community event, with access needs.',
    title: 'Event registration',
    description: 'Please register so we can plan for you. Tell us if there is anything that would help you take part.',
    questions: [
      q('Full name', 'short', { required: true }),
      q('Email address', 'email', { required: true }),
      q('Phone number', 'short'),
      q('Organisation (if any)', 'short'),
      q('Which session will you attend?', 'dropdown', { required: true, options: ['Morning', 'Afternoon', 'Whole day'] }),
      q('Will you attend in person or online?', 'choice', { required: true, options: ['In person', 'Online'] }),
      q('Dietary needs', 'short'),
      q('Access needs or anything else that would help you take part', 'paragraph'),
    ],
    settings: { confirmation: 'You are registered. We will send the details by email.' },
  },
  {
    id: 'volunteer',
    name: 'Volunteer interest',
    kind: 'Registration',
    blurb: 'Collect offers of time and skills, and when people are free.',
    title: 'Volunteer with us',
    description: 'Thank you for offering your time. Tell us a little about you and how you would like to help.',
    questions: [
      q('Full name', 'short', { required: true }),
      q('Email address', 'email', { required: true }),
      q('Phone number', 'short'),
      q('How would you like to help?', 'checkbox', { options: ['Outreach and awareness', 'Events', 'Administration', 'Fundraising', 'Skills-based (legal, medical, counselling, design, writing)'] }),
      q('Tell us about your skills or experience', 'paragraph'),
      q('When are you usually available?', 'checkbox', { options: ['Weekday mornings', 'Weekday afternoons', 'Evenings', 'Weekends'] }),
      q('Have you volunteered before?', 'choice', { options: ['Yes', 'No'] }),
    ],
    settings: { confirmation: 'Thank you. We will be in touch soon.' },
  },
  {
    id: 'training-evaluation',
    name: 'Training evaluation',
    kind: 'Survey',
    blurb: 'Measure what people learned and how useful a session was.',
    title: 'Training evaluation',
    description: 'Help us make the next session better. This is anonymous unless you choose to share your name.',
    questions: [
      q('Which session did you attend?', 'short', { required: true }),
      q('The content was relevant to my work or life', 'scale', { required: true, scale: { min: 1, max: 5, minLabel: 'Disagree', maxLabel: 'Agree' } }),
      q('The facilitator explained things clearly', 'scale', { scale: { min: 1, max: 5, minLabel: 'Disagree', maxLabel: 'Agree' } }),
      q('I feel more confident about the topic', 'scale', { scale: { min: 1, max: 5, minLabel: 'Disagree', maxLabel: 'Agree' } }),
      q('What will you do differently after this training?', 'paragraph'),
      q('What topics would you like next?', 'paragraph'),
    ],
    settings: { confirmation: 'Thank you for your feedback.' },
  },
];

export const templateById = (id: string) => FORM_TEMPLATES.find((t) => t.id === id) ?? null;

const uid = () => Math.random().toString(36).slice(2, 10);

/** Questions with fresh ids, ready to be saved on a new form. */
export function questionsFrom(t: FormTemplate): Question[] {
  return t.questions.map((x) => ({ ...x, id: uid() }) as Question);
}
