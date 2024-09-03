const Thread = require('../models/Thread');
const Reply = require('../models/Reply');

const BcryptService = require('./BcryptService');

async function hash(value) {
    let result;
    if (value) {
        result = await BcryptService.hash(value);
    }
    return result;
}

module.exports.createThread = async function(boardId, text, deletePassword) {
    const deletePasswordHash = await hash(deletePassword);

    const thread = new Thread({
        board: boardId,
        text,
        delete_password: deletePasswordHash,
    });

    return await thread.save();
};

module.exports.createReply = async function(threadId, text, deletePassword) {
    const deletePasswordHash = await hash(deletePassword);

    let reply = new Reply({
        text,
        delete_password: deletePasswordHash,
    });

    reply = await reply.save();

    await Thread.findByIdAndUpdate(threadId, { 
        $push: { replies: reply._id },
        $inc: { replycount: 1 },
        bumped_on: new Date()},
        { new: true, useFindAndModify: false });

    return reply;
}