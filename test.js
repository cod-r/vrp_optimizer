const express = require('express')
let appTest = require('./public/app')
const app = express()
const port = 3000
app.use(express.static('public'))


app.get('/', (req, res) => {

    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})