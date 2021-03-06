/* eslint no-unused-expressions: 0 */
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import irc from 'irc';
import logger from 'winston';
import discord from 'discord.js';
import Bot from '../lib/bot';
import DiscordStub from './stubs/discord-stub';
import ClientStub from './stubs/irc-client-stub';
import config from './fixtures/single-test-config.json';

chai.should();
chai.use(sinonChai);

describe('Bot', function() {
  const discordChannel = DiscordStub.prototype.getChannel();
  const sandbox = sinon.sandbox.create({
    useFakeTimers: false,
    useFakeServer: false
  });

  beforeEach(function() {
    sandbox.stub(logger, 'info');
    sandbox.stub(logger, 'debug');
    sandbox.stub(logger, 'error');
    irc.Client = ClientStub;
    discord.Client = DiscordStub;
    DiscordStub.prototype.sendMessage = sandbox.stub();
    ClientStub.prototype.say = sandbox.stub();
    ClientStub.prototype.send = sandbox.stub();
    ClientStub.prototype.join = sandbox.stub();
    this.bot = new Bot(config);
    this.bot.connect();
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('should invert the channel mapping', function() {
    this.bot.invertedMapping['#irc'].should.equal('#discord');
  });

  it('should send correctly formatted messages to discord', function() {
    const username = 'testuser';
    const text = 'test message';
    const formatted = '**<' + username + '>** ' + text;
    this.bot.sendToDiscord(username, '#irc', text);
    DiscordStub.prototype.sendMessage.should.have.been.calledWith(discordChannel, formatted);
  });

  it('should lowercase channel names before sending to discord', function() {
    const username = 'testuser';
    const text = 'test message';
    const formatted = '**<' + username + '>** ' + text;
    this.bot.sendToDiscord(username, '#IRC', text);
    DiscordStub.prototype.sendMessage.should.have.been.calledWith(discordChannel, formatted);
  });

  it('should not send messages to discord if the channel isn\'t in the channel mapping',
  function() {
    this.bot.sendToDiscord('user', '#otherirc', 'message');
    DiscordStub.prototype.sendMessage.should.not.have.been.called;
  });

  it('should send correct messages to irc', function() {
    const text = 'testmessage';
    const message = {
      content: text,
      mentions: [],
      channel: {
        name: 'discord'
      },
      author: {
        username: 'otherauthor',
        id: 'not bot id'
      }
    };

    this.bot.sendToIRC(message);
    // Wrap in colors:
    const expected = `<\u000304${message.author.username}\u000f> ${text}`;
    ClientStub.prototype.say.should.have.been.calledWith('#irc', expected);
  });

  it('should not send its own messages to irc', function() {
    const message = {
      author: {
        username: 'bot',
        id: this.bot.discord.user.id
      }
    };

    this.bot.sendToIRC(message);
    ClientStub.prototype.say.should.not.have.been.called;
  });

  it('should not send messages to irc if the channel isn\'t in the channel mapping',
  function() {
    const message = {
      channel: {
        name: 'wrongdiscord'
      },
      author: {
        username: 'otherauthor',
        id: 'not bot id'
      }
    };

    this.bot.sendToIRC(message);
    ClientStub.prototype.say.should.not.have.been.called;
  });

  it('should parse text from discord when sending messages', function() {
    const text = '<#1234>';
    const message = {
      content: text,
      mentions: [],
      channel: {
        name: 'discord'
      },
      author: {
        username: 'test',
        id: 'not bot id'
      }
    };

    // Wrap it in colors:
    const expected = `<\u000312${message.author.username}\u000f> #${message.channel.name}`;
    this.bot.sendToIRC(message);
    ClientStub.prototype.say
      .should.have.been.calledWith('#irc', expected);
  });

  it('should convert user mentions from discord', function() {
    const message = {
      mentions: [{
        id: 123,
        username: 'testuser'
      }],
      content: '<@123> hi'
    };

    this.bot.parseText(message).should.equal('@testuser hi');
  });

  it('should convert newlines from discord', function() {
    const message = {
      mentions: [],
      content: 'hi\nhi\r\nhi\r'
    };

    this.bot.parseText(message).should.equal('hi hi hi ');
  });

  it('should hide usernames for commands', function() {
    const text = '!test command';
    const message = {
      content: text,
      mentions: [],
      channel: {
        name: 'discord'
      },
      author: {
        username: 'test',
        id: 'not bot id'
      }
    };

    this.bot.sendToIRC(message);
    ClientStub.prototype.say.getCall(0).args.should.deep.equal([
      '#irc', 'Command sent from Discord by test:'
    ]);
    ClientStub.prototype.say.getCall(1).args.should.deep.equal(['#irc', text]);
  });
});
