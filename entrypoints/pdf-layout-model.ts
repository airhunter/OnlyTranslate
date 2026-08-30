import { startPdfLayoutModelWorker } from './pdf/layoutModel.worker'

export default defineUnlistedScript(() => {
  startPdfLayoutModelWorker()
})
