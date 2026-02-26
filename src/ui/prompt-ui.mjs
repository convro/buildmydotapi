import inquirer from 'inquirer';
import chalk from 'chalk';
import figures from 'figures';

// ─── Ask a Single Question ────────────────────────────────────────────────────

/**
 * Ask one AI-generated question via inquirer.
 * @param {object} q       - Question definition from AI
 * @param {number} index   - Current question index (1-based)
 * @param {number} total   - Total number of questions
 */
export async function askQuestion(q, index, total) {
  const counter = chalk.gray(`[${index}/${total}]`);
  const prefix  = chalk.cyan(`${figures.pointer} ${counter}`);

  const base = {
    name:    q.id,
    message: `${prefix} ${q.message}`,
    prefix:  '',
  };

  let question;

  if (q.type === 'list') {
    question = {
      ...base,
      type:    'list',
      choices: q.choices || [],
    };
  } else if (q.type === 'confirm') {
    question = {
      ...base,
      type:    'confirm',
      default: q.default !== undefined ? q.default : false,
    };
  } else {
    // default: input
    question = {
      ...base,
      type:    'input',
      default: q.default !== undefined ? String(q.default) : undefined,
    };

    if (q.validate === 'port_number') {
      question.validate = (val) => {
        const port = parseInt(val, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          return 'Please enter a valid port number (1–65535)';
        }
        return true;
      };
    }
  }

  const answers = await inquirer.prompt([question]);
  console.log(`  ${chalk.green(figures.tick)} Got it\n`);
  return answers[q.id];
}

// ─── Ask All Questions ────────────────────────────────────────────────────────

export async function askAllQuestions(questions) {
  const answers = {};
  for (let i = 0; i < questions.length; i++) {
    answers[questions[i].id] = await askQuestion(questions[i], i + 1, questions.length);
  }
  return answers;
}

// ─── Project Directory Picker ─────────────────────────────────────────────────

export async function askProjectDirectory(projectName) {
  const homeProjects = `${process.env.HOME || '/root'}/projects/${projectName}`;
  const varWww       = `/var/www/${projectName}`;

  const { location } = await inquirer.prompt([
    {
      type:    'list',
      name:    'location',
      message: `${chalk.cyan(figures.pointer)} Where should the project be created?`,
      prefix:  '',
      choices: [
        { name: varWww,       value: varWww },
        { name: homeProjects, value: homeProjects },
        { name: 'Custom path…', value: 'custom' },
      ],
    },
  ]);

  if (location === 'custom') {
    const { customPath } = await inquirer.prompt([
      {
        type:    'input',
        name:    'customPath',
        message: `${chalk.cyan(figures.pointer)} Enter custom path:`,
        prefix:  '',
        default: `/opt/${projectName}`,
      },
    ]);
    console.log(`  ${chalk.green(figures.tick)} Got it\n`);
    return customPath;
  }

  console.log(`  ${chalk.green(figures.tick)} Got it\n`);
  return location;
}

// ─── Yes / No Confirmation ────────────────────────────────────────────────────

export async function confirm(message, defaultVal = false) {
  const { confirmed } = await inquirer.prompt([
    {
      type:    'confirm',
      name:    'confirmed',
      message: chalk.yellow(message),
      prefix:  chalk.yellow(figures.warning),
      default: defaultVal,
    },
  ]);
  return confirmed;
}
