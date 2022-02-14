import git from 'isomorphic-git';
import { stdin, MockSTDIN } from 'mock-stdin';
import { getGitRepositoryURL, validateGitRepositoryURL } from '../../../src/domains/git-repository-url';

jest.mock('../../../src/domains/git-repository-url/validateGitRepositoryURL');

const ENTER_KEY = '\x0D';
const BACKSPACE_KEY = '\x08';

type MockValidate = jest.MockedFunction<typeof validateGitRepositoryURL>;

const wait = (time: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
};

describe('getGitRepositoryURL', () => {
  let io: MockSTDIN;
  let output = '';

  beforeEach(() => {
    io = stdin();
    output = '';

    jest.spyOn(process.stdout, 'write').mockImplementation((message) => {
      output += message as string;
      return true;
    });
  });

  it('gets git repository URL from user', async () => {
    const answer = async () => {
      expect(output).toContain('What\'s your git repository URL?');

      io.send(' ');
      io.send(ENTER_KEY);

      await wait(100);

      expect(output).toContain('Please type in a valid git repository URL.');

      io.send(BACKSPACE_KEY);
      io.send('https://github.com/x/x.git');
      io.send(ENTER_KEY);

      await wait(100);

      expect(output).toContain('Couldn\'t locate git repository with the received URL.');

      io.send(BACKSPACE_KEY.repeat(5));
      io.send('y.git');
      io.send(ENTER_KEY);
    };

    wait(100).then(answer);

    (validateGitRepositoryURL as MockValidate)
      .mockResolvedValueOnce([
        false,
        new git.Errors.UrlParseError(' ')
      ])
      .mockResolvedValueOnce([
        false,
        new git.Errors.NotFoundError('https://github.com/x/x.git')
      ])
      .mockResolvedValueOnce([true, null]);

    const gitRepositoryURL = await getGitRepositoryURL('What\'s your git repository URL?');

    expect(gitRepositoryURL).toBe('https://github.com/x/y.git');
  });

  describe('when user input unsupported git repository URL', () => {
    it('allow user to select suggestion as answer', async () => {
      const answer = async () => {
        expect(output).toContain('What\'s your git repository URL?');

        io.send('git@github.com:x/x.git');
        io.send(ENTER_KEY);

        await wait(100);

        expect(output).toContain('Use "https://github.com/x/x.git" instead?');

        // Cleanup the output.
        output = '';

        io.send('N');
        io.send(ENTER_KEY);

        await wait(100);

        expect(output).toContain('What\'s your git repository URL?');

        io.send('git@github.com:x/y.git');
        io.send(ENTER_KEY);

        await wait(100);

        expect(output).toContain('Use "https://github.com/x/y.git" instead?');

        io.send('Y');
        io.send(ENTER_KEY);
      };

      wait(100).then(answer);

      (validateGitRepositoryURL as MockValidate)
        .mockResolvedValueOnce([
          false,
          new git.Errors.UnknownTransportError(
            'git@github.com:x/x.git',
            'ssh',
            'https://github.com/x/x.git'
          )
        ])
        .mockResolvedValueOnce([true, null])
        .mockResolvedValueOnce([
          false,
          new git.Errors.UnknownTransportError(
            'git@github.com:x/y.git',
            'ssh',
            'https://github.com/x/y.git'
          )
        ])
        .mockResolvedValueOnce([true, null]);

      const result = await getGitRepositoryURL('What\'s your git repository URL?');

      expect(result).toBe('https://github.com/x/y.git');
    });
  });
});