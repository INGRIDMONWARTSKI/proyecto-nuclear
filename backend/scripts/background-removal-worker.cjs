let pipelinePromise = null;

async function getPipeline(modelId) {
  if (!pipelinePromise) {
    pipelinePromise = import('@huggingface/transformers')
      .then(({ pipeline }) => pipeline('background-removal', modelId))
      .catch((error) => {
        pipelinePromise = null;
        throw error;
      });
  }

  return pipelinePromise;
}

function readErrorMessage(error) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'No fue posible preparar la transparencia; se usara la imagen original.';
}

process.on('message', async (message) => {
  if (!message || message.type !== 'remove') {
    return;
  }

  try {
    const pipeline = await getPipeline(message.modelId);
    const result = await pipeline(message.imagePath);
    const processedBuffer = await result.toSharp().png().toBuffer();

    if (!processedBuffer?.byteLength) {
      process.send?.({
        type: 'error',
        requestId: message.requestId,
        warning: 'La remocion de fondo devolvio un PNG vacio.',
      });
      return;
    }

    process.send?.({
      type: 'success',
      requestId: message.requestId,
      processedBase64: processedBuffer.toString('base64'),
    });
  } catch (error) {
    process.send?.({
      type: 'error',
      requestId: message.requestId,
      warning: readErrorMessage(error),
    });
  }
});
