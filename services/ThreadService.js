const Thread = require('../models/Thread');
const Reply = require('../models/Reply');
const InvalidPasswordError = require('../errors/InvalidPasswordError');

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
        thread_id: threadId,
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

module.exports.getRecentThreadsAndReplies = async function(boardId) {
    const threads = await Thread.find({ board: boardId })
        .sort({ bumped_on: -1 })
        .limit(10)
        .populate({
            path: 'replies',
            options: {
                sort: { created_on: -1 },
                //limit: 3,
            },
            select: '-reported -delete_password',
        })
        .select('-reported -delete_password')
    
    // as the limit option is not working for the subdocuments, then manually trim them.
    const threadsTrimmedReplies = [];
    threads.forEach(t => {
        threadsTrimmedReplies.push({
            ...t._doc,
            replies: t._doc.replies.slice(0, 3),
        });
    });

    return threadsTrimmedReplies;
}

module.exports.deleteThread = async function(threadId, deletePassword) {
    const thread = await Thread.findById(threadId, ['_id', 'delete_password']);
    const validPassword = await BcryptService.compare(deletePassword, thread.delete_password);
    if (!validPassword) throw new InvalidPasswordError('invalid password');
    await Thread.findByIdAndDelete(thread._id);
    await Reply.deleteMany({ thread_id: threadId });
}

module.exports.reportThread = async function(threadId) {
    await Thread.findByIdAndUpdate(threadId, { reported: true }, { useFindAndModify: false });
}