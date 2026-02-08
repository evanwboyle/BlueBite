#!/bin/bash
npm run dev &
(cd backend && npm run dev) &
wait