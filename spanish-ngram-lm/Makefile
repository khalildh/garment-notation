# Spanish character n-gram model pipeline.
#   make test                          run normalization contract tests
#   make pilot                         synth corpus -> train 4&5-gram -> eval (no external network)
#   make corpus                        download + extract Spanish Wikipedia (needs network)
#   make train TRAIN=data/train.chars  train from real exploded corpus
# Set KENLM_BIN if lmplz/build_binary are not on PATH.

PY := python3
DATA := data
MODELS := models
PILOT_LINES := 500000

.PHONY: test pilot corpus train eval clean

test:
	$(PY) tests/test_normalize.py

$(DATA)/pilot.raw.txt:
	mkdir -p $(DATA)
	$(PY) scripts/synth_corpus_wordfreq.py $(PILOT_LINES) > $@

pilot: $(DATA)/pilot.raw.txt
	$(PY) scripts/normalize.py < $(DATA)/pilot.raw.txt > $(DATA)/pilot.chars.txt
	# held-out split: last 5000 lines for dev, rest for training
	head -n -5000 $(DATA)/pilot.chars.txt > $(DATA)/pilot.train.txt
	tail -n 5000 $(DATA)/pilot.chars.txt > $(DATA)/pilot.dev.txt
	bash scripts/train.sh $(DATA)/pilot.train.txt $(MODELS) 4 5
	$(PY) scripts/normalize.py < tests/sample_es.txt > $(DATA)/sample_es.chars.txt
	$(PY) scripts/normalize.py < tests/sample_en.txt > $(DATA)/sample_en.chars.txt
	@for o in 4 5; do \
	  $(PY) scripts/eval_bpc.py $(MODELS)/es-char-$${o}gram.bin $(DATA)/pilot.dev.txt heldout-synth; \
	  $(PY) scripts/eval_bpc.py $(MODELS)/es-char-$${o}gram.bin $(DATA)/sample_es.chars.txt real-spanish; \
	  $(PY) scripts/eval_bpc.py $(MODELS)/es-char-$${o}gram.bin $(DATA)/sample_en.chars.txt real-english; \
	done

corpus:
	bash scripts/download_wiki.sh $(DATA)

train:
	bash scripts/train.sh $(TRAIN) $(MODELS) 4 5

clean:
	rm -rf $(DATA) $(MODELS)
