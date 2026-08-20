import { Injectable } from '@angular/core';
import {
  ParsedCitation,
  ParsedCreator,
  ParsedCitationType
} from '../models/parsed-citation.model';
import { CitationSnifferService } from './citation-sniffer.service'
@Injectable({
  providedIn: 'root'
})
export class CitationParserService {

    constructor(
      private citationSnifferService: CitationSnifferService

    ){}
    parseBlock(
      text: string,
      context: Partial<ParsedCitation>
    ): ParsedCitation[] {

      const entries = this.splitEntries(text);
      const results: ParsedCitation[] = [];

      for (const entry of entries) {
        if (this.isLikelyCallNumber(entry)) {
          continue;
        }

        try {
          const parsed = this.parseEntry(entry, context);

          if (
            !parsed.title &&
            !parsed.creators.length &&
            !parsed.year
          ) {
            console.error(
              'Citation could not be parsed:',
              entry,
              parsed.parseWarnings
            );
          }

          // IMPORTANT:
          // Still retain the result so it gets exported.
          results.push(parsed);

        } catch (error) {
          console.error(
            'Citation parser exception:',
            entry,
            error
          );

          // Add an error row rather than aborting the entire batch.
          results.push(
            this.createFailedCitation(entry, context, error)
          );
        }
      }

      return results;
    }
    private createFailedCitation(
      raw: string,
      context: Partial<ParsedCitation>,
      error: unknown
    ): ParsedCitation {

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      return {
        raw,
        type: 'unknown',
        title: '',
        containerTitle: '',
        publisher: '',
        publicationPlace: '',
        year: '',
        volume: '',
        issue: '',
        pages: '',
        edition: '',
        doi: '',
        isbn: '',
        issn: '',
        url: '',
        creators: [],

        parseWarnings: [
          `Citation parser error: ${message}`
        ],

        confidence: null,

        courseName: context.courseName || '',
        instructor: context.instructor || '',
        courseNumber: context.courseNumber || '',
        courseSemester: context.courseSemester || '',
        courseTermForMapping:
          context.courseTermForMapping || '',
        courseYearForMapping:
          context.courseYearForMapping || ''
      };
    }

  splitEntries(text: string): string[] {
    const normalized = (text || '').replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    // First split on blank lines.
    let entries = normalized
      .split(/\n\s*\n/g)
      .map(x => this.cleanWhitespace(x))
      .filter(Boolean);

    // If there were no blank-line separations, treat each line as an entry.
    if (entries.length <= 1) {
      entries = normalized
        .split('\n')
        .map(x => x.replace(/^\s*(\[\d+\]|\d+\.)\s*/, ''))
        .map(x => this.cleanWhitespace(x))
        .filter(Boolean);
    }

    return entries;
  }

  parseEntry(raw: string, context: Partial<ParsedCitation>): ParsedCitation {
    //console.log(raw)
    let format = this.citationSnifferService.determineCitationFormat(raw)
      //   block.citationsText,
      //   {
      //     courseName: block.courseName,
      //     instructor: block.instructorLastName,
      //     courseNumber: block.courseNumber,
      //     courseSemester: block.courseSemester,
      //     courseYear: block.courseYear,
      //     courseTermForMapping: block.courseTermForMapping,
      //     courseYearForMapping: block.courseYearForMapping
      //   } as any
      // );
    

    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
 
    const year = this.extractYear(cleaned, format);
    const creators = this.extractCreators(cleaned, format);
    const title = this.extractTitle(cleaned, format);
    const containerTitle = this.extractContainerTitle(cleaned, title);
    const publisher = this.extractPublisher(
      cleaned,
      title,
      containerTitle,
      format
    );
    const publicationPlace = this.extractPublicationPlace(
      cleaned,
      format
    );
    const type = this.inferType(cleaned, title, containerTitle);
    console.log('Parsed creators:', creators);
    // console.log('Parsed title:', title);
    // console.log('Parsed container title:', containerTitle);
    // console.log('Parsed publisher:', publisher);
    // console.log('Parsed publication place:', publicationPlace);
    // console.log('Parsed year:', year);
    // console.log('volume:', this.extractVolume(cleaned));
    // console.log('issue:', this.extractIssue(cleaned));
    // console.log('pages:', this.extractPages(cleaned));
    // console.log('doi:', this.extractDoi(cleaned));
    // console.log('isbn:', this.extractIsbn(cleaned));
    // console.log('issn:', this.extractIssn(cleaned));
    // console.log('url:', this.extractUrl(cleaned));
    // console.log('parseWarnings:', this.buildWarnings(cleaned, creators, title, year));
    // console.log('confidence:', null);
    // console.log('courseName:', context.courseName || '');
    // console.log('instructor:', context.instructor || '');
    // console.log('courseNumber:', context.courseNumber || '');
    // console.log('courseSemester:', context.courseSemester || '');
    // console.log('courseTermForMapping:', context.courseTermForMapping || '');
    // console.log('courseYearForMapping:', context.courseYearForMapping || '');
    return {
      raw,
      type,
      title,
      containerTitle,
      publisher,
      publicationPlace,
      year,
      volume: this.extractVolume(cleaned),
      issue: this.extractIssue(cleaned),
      pages: this.extractPages(cleaned),
      edition: '',
      doi: this.extractDoi(cleaned),
      isbn: this.extractIsbn(cleaned),
      issn: this.extractIssn(cleaned),
      url: this.extractUrl(cleaned),
      creators,
      parseWarnings: this.buildWarnings(cleaned, creators, title, year),
      confidence: null,
      courseName: context.courseName || '',
      instructor: context.instructor || '',
      courseNumber: context.courseNumber || '',
      courseSemester: context.courseSemester || '',
      courseTermForMapping: context.courseTermForMapping || '',
      courseYearForMapping: context.courseYearForMapping || ''
    };
  }

  private cleanWhitespace(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private isLikelyCallNumber(raw: string): boolean {
    const cleaned = this.cleanWhitespace(raw);

    // LC call-number-ish lines:
    // HT166 .G438 2010
    // PN1998.3.H36875 A3 2017
    // JC179.M753 B54 2016
    // E184.A75 L86 2017
    return /^[A-Z]{1,3}\d+(?:\.\d+)?(?:\s+[A-Z0-9.]+)+(?:\s+\d{4})?$/u.test(cleaned);
  }

  private stripTrailingCallNumber(raw: string): string {
    return raw
      .replace(/\.\s*[A-Z]{1,3}\d+(?:\.\d+)?(?:\s+[A-Z0-9.]+)+(?:\s+\d{4})?\s*$/u, '.')
      .replace(/\s+[A-Z]{1,3}\d+(?:\.\d+)?(?:\s+[A-Z0-9.]+)+(?:\s+\d{4})?\s*$/u, '')
      .trim();
  }

  private splitAuthorYearParenCitation(raw: string): { creatorPart: string; year: string; rest: string } | null {
    const cleaned = this.cleanWhitespace(raw);
    const match = cleaned.match(/^(.+?)\s*\((\d{4})\)[,\.]?\s*(.+)$/u);

    if (!match) {
      return null;
    }

    return {
      creatorPart: match[1].trim().replace(/[,;:\s]+$/u, ''),
      year: match[2],
      rest: match[3].trim()
    };
  }

  private splitAuthorDateCitation(raw: string): { creatorPart: string; year: string; rest: string } | null {
    const cleaned = this.cleanWhitespace(raw);

    // Chicago-ish:
    // Gehl, Jan. 2010. Cities for people. Washington, DC: Island Press.
    // Harris, Brandon. 2017. Making rent in Bed-Stuy. New York: Harper-Collins.
    const match = cleaned.match(/^(.+?)\.\s+([1-2]\d{3})\.\s+(.+)$/u);

    if (!match) {
      return null;
    }

    return {
      creatorPart: match[1].trim(),
      year: match[2],
      rest: match[3].trim()
    };
  }

  private getPublicationBlock(raw: string): { prefix: string; parenContent: string } | null {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));
    const match = cleaned.match(/^(.*?)(\(([^()]*(?:\d{4})[^()]*)\))\.?$/u);

    if (!match) {
      return null;
    }

    return {
      prefix: match[1].trim().replace(/[,;:\s]+$/u, ''),
      parenContent: match[3].trim()
    };
  }

  private parseCreatorString(
    creatorText: string,
    role: ParsedCreator['role']
  ): ParsedCreator[] {
    let working = this.cleanWhitespace(creatorText)
      .replace(/^\s*(edited by|translated by|directed by)\s+/i, '')
      .replace(/\((?:eds?\.?|trans\.?|dir\.?)\)/gi, '')
      .replace(/\b(?:eds?\.?|trans\.?|dir\.)\b\.?/gi, '')
      .replace(/\bet al\.?\b/gi, '')
      .trim();

    if (!working) {
      return [];
    }

    working = working
      .replace(/\s+and\s+/gi, '; ')
      .replace(/\s*&\s*/g, '; ')
      .replace(/\s*;\s*/g, '; ');

    const parts = working.split(';').map(x => x.trim()).filter(Boolean);

    return parts.map((name): ParsedCreator => {
      // Last, First
      if (name.includes(',')) {
        const bits = name.split(',').map(x => x.trim()).filter(Boolean);
        return {
          family: bits[0] || '',
          given: bits.slice(1).join(' '),
          role
        };
      }

      // First Last
      const tokens = name.split(/\s+/).filter(Boolean);

      if (tokens.length === 1) {
        return {
          family: tokens[0],
          given: '',
          role
        };
      }

      return {
        family: tokens[tokens.length - 1],
        given: tokens.slice(0, -1).join(' '),
        role
      };
    });
  }

  private splitBookListPrefix(
    raw: string
  ): { creatorPart: string; titlePart: string } {

    const cleaned = this.stripTrailingCallNumber(
      this.cleanWhitespace(raw)
    );

    const pubBlock = this.getPublicationBlock(cleaned);
    const prefix = pubBlock ? pubBlock.prefix : cleaned;

    // Explicit editor/translator/director marker gives us
    // an excellent boundary between creators and title.
    const roleSplit = prefix.match(
      /^(.*?(?:\((?:eds?\.?|trans\.?|dir\.?)\)|\b(?:eds?\.?|trans\.?|dir\.?)\b))\s*,\s*(.+)$/i
    );

    if (roleSplit) {
      return {
        creatorPart: roleSplit[1].trim(),
        titlePart: roleSplit[2].trim()
      };
    }

    /*
    * General author-list form.
    *
    * Examples:
    *
    * August Reinisch, Advanced Introduction...
    *
    * Jonathan Bonnitcha, Lauge N. Skovgaard Poulsen,
    * and Michael Waibel, The Political Economy...
    *
    * We find the comma that terminates the creator list,
    * rather than blindly using the first comma.
    */

    const andAuthorMatch = prefix.match(
      /^(.*?\band\s+[A-Z][^,]+),\s+(.+)$/u
    );

    if (andAuthorMatch) {
      return {
        creatorPart: andAuthorMatch[1].trim(),
        titlePart: andAuthorMatch[2].trim()
      };
    }

    // Single-author form.
    const singleAuthorMatch = prefix.match(
      /^([^,]+),\s+(.+)$/u
    );

    if (singleAuthorMatch) {
      return {
        creatorPart: singleAuthorMatch[1].trim(),
        titlePart: singleAuthorMatch[2].trim()
      };
    }

    return {
      creatorPart: '',
      titlePart: prefix.trim()
    };
  }

  private extractYear(raw: string, format: string): string {
    const cleaned = this.stripTrailingCallNumber(
      this.cleanWhitespace(raw)
    );

    // Preserve your existing legal/book-list citation handling:
    // Title (Oxford University Press 2015).
    const pubBlock = this.getPublicationBlock(cleaned);

    if (pubBlock) {
      const match = pubBlock.parenContent.match(/\b([12]\d{3})\b/);

      if (match) {
        return match[1];
      }
    }

    let match: RegExpMatchArray | null = null;

    if (format === 'APA' || format === 'Harvard') {
      match = cleaned.match(/\(([12]\d{3})\)/);

      if (match) {
        return match[1];
      }
    }

    if (format === 'Chicago') {
      match = cleaned.match(/\.\s+([12]\d{3})\.\s+/);

      if (match) {
        return match[1];
      }
    }

    if (format === 'MLA') {
      match = cleaned.match(/,\s*([12]\d{3})\.?\s*$/);

      if (match) {
        return match[1];
      }
    }

    // Generic fallback.
    const years = cleaned.match(/\b[12]\d{3}\b/g);

    return years && years.length
      ? years[years.length - 1]
      : '';
  }

  private extractCreators(
    raw: string,
    format: string
  ): ParsedCreator[] {

    const cleaned = this.stripTrailingCallNumber(
      this.cleanWhitespace(raw)
    );

    /*
    * Your existing legal/book-list style:
    *
    * August Reinisch, Advanced Introduction...
    *   (Elgar 2020).
    *
    * George A. Bermann (ed.), Recognition...
    *   (Springer 2017).
    */
    const pubBlock = this.getPublicationBlock(cleaned);

    if (pubBlock) {
      const bookSplit = this.splitBookListPrefix(cleaned);

      if (bookSplit.creatorPart) {
        let creatorText = bookSplit.creatorPart;
        let role: ParsedCreator['role'] = 'author';

        if (
          /\((?:eds?\.?)\)|\b(?:eds?\.?|edited by)\b/i.test(
            creatorText
          )
        ) {
          role = 'editor';

        } else if (
          /\((?:trans\.?)\)|\b(?:trans\.?|translated by)\b/i.test(
            creatorText
          )
        ) {
          role = 'translator';

        } else if (
          /\((?:dir\.?)\)|\b(?:dir\.?|directed by)\b/i.test(
            creatorText
          )
        ) {
          role = 'director';
        }

        return this.parseCreatorString(
          creatorText,
          role
        );
      }
    }

    /*
    * Chicago:
    *
    * Dillard, Annie. 2007. The Writing Life.
    */
    if (format === 'Chicago') {
      const split = this.splitAuthorDateCitation(cleaned);

      if (split) {
        return this.parseCreatorString(
          split.creatorPart,
          'author'
        );
      }
    }

    /*
    * APA / Harvard:
    *
    * Dillard, A. (2007) ...
    * Dillard, A. (2007). ...
    */
    if (format === 'APA' || format === 'Harvard') {
      const split = this.splitAuthorYearParenCitation(cleaned);

      if (split) {
        return this.parseCreatorString(
          split.creatorPart,
          'author'
        );
      }
    }

    /*
    * MLA:
    *
    * Dillard, Annie. The Writing Life...
    */
    if (format === 'MLA') {
      const match = cleaned.match(
        /^(.+?)\.\s+(?=\S)/u
      );

      if (match) {
        return this.parseCreatorString(
          match[1],
          'author'
        );
      }
    }

    // Last-resort fallback.
    const creatorMatch = cleaned.match(/^(.+?)\.\s+/);
    const creatorText = creatorMatch?.[1] || '';

    return this.parseCreatorString(
      creatorText,
      'author'
    );
  }

  private extractTitle(raw: string, format: string): string {
    const cleaned = this.stripTrailingCallNumber(this.cleanWhitespace(raw));

    // Book-list citations with publication information in parentheses.
    const pubBlock = this.getPublicationBlock(cleaned);

    if (pubBlock) {
      const bookSplit = this.splitBookListPrefix(cleaned);

      if (bookSplit.titlePart) {
        return bookSplit.titlePart
          .replace(/[.,]\s*$/, '')
          .trim();
      }
    }

    let title = '';

    if (format === 'APA or Harvard') {
      title =
        (cleaned.match(/^[^.]+?\.\s*\(\d{4}\)\.?\s*(.+?)\./) || [])[1] || '';
    } else {
      title =
        (cleaned.match(/^[^.]+?\.\s*\(?\d{4}\)?\.?\s*([^.]+)/) || [])[1] || '';
    }

    return title.trim().replace(/\.$/, '');
  }

  private extractContainerTitle(raw: string, title: string): string {
    let working = this.cleanWhitespace(raw);

    if (!working || !title) {
      return '';
    }

    const quotedTitle = new RegExp(`["“]${this.escapeRegExp(title)}["”]`);
    if (quotedTitle.test(working)) {
      working = working.replace(quotedTitle, '').trim();
    } else {
      const titleIndex = working.indexOf(title);
      if (titleIndex >= 0) {
        working = working.slice(titleIndex + title.length).trim();
      }
    }

    working = working.replace(/^[:;.,)\]\s-]+/, '').trim();

    const inMatch = working.match(/\bIn\s+([^.,]+(?:\.[^.,]+)*)/i);
    if (inMatch) {
      return inMatch[1].trim();
    }

    const journalMatch = working.match(/^([^.,]+?)(?=,?\s*(?:vol\.?|no\.?|issue|pp?\.?|doi\b|\d+\s*\())/i);
    if (journalMatch) {
      return journalMatch[1].trim();
    }

    return '';
  }

  private extractPublisher(
    raw: string,
    title: string,
    _containerTitle: string,
    format: string
  ): string {

    const cleaned = this.stripTrailingCallNumber(
      this.cleanWhitespace(raw)
    );

    /*
    * Existing parenthetical book-list style:
    *
    * August Reinisch, Advanced Introduction...
    *   (Elgar 2020).
    *
    * Title (Oxford University Press 2015).
    *
    * Title (New York: Routledge, 2018).
    */
    const pubBlock = this.getPublicationBlock(cleaned);

    if (pubBlock) {
      const content = pubBlock.parenContent;

      // Place: Publisher, Year
      //
      // New York: Routledge, 2018
      const colonMatch = content.match(
        /^[^:]+:\s*(.+?)(?:,\s*[1-2]\d{3})$/u
      );

      if (colonMatch) {
        return colonMatch[1].trim();
      }

      // Publisher Year
      //
      // Oxford University Press 2015
      const simpleMatch = content.match(
        /^(.+?)\s+([1-2]\d{3})$/u
      );

      if (simpleMatch) {
        return simpleMatch[1].trim();
      }

      // Generic fallback for parenthetical publication information.
      return content
        .replace(/\b[1-2]\d{3}\b/gu, '')
        .replace(/[,:]\s*$/, '')
        .trim();
    }


    /*
    * Chicago Author-Date:
    *
    * Dillard, Annie. 2007. The Writing Life.
    * Pymble, NSW: HarperCollins e-books.
    */
    if (format === 'Chicago') {
      const authorDateSplit =
        this.splitAuthorDateCitation(cleaned);

      if (authorDateSplit) {
        const afterYear = authorDateSplit.rest;

        /*
        * afterYear:
        *
        * The Writing Life. Pymble, NSW:
        * HarperCollins e-books.
        */
        const pubMatch = afterYear.match(
          /\.\s+([^:]+):\s+(.+?)\.?$/u
        );

        if (pubMatch) {
          return pubMatch[2]
            .trim()
            .replace(/\.$/, '');
        }
      }
    }


    /*
    * Harvard:
    *
    * Dillard, A. (2007) The Writing Life.
    * Pymble, NSW: HarperCollins e-books.
    */
    if (format === 'Harvard') {

      /*
      * Since the title may contain punctuation,
      * use the final Place: Publisher structure
      * rather than trying to count periods.
      */
      const pubMatch = cleaned.match(
        /\.\s+([^:]+):\s+(.+?)\.?$/u
      );

      if (pubMatch) {
        return pubMatch[2]
          .trim()
          .replace(/\.$/, '');
      }
    }


    /*
    * APA 7:
    *
    * Dillard, A. (2007). The writing life.
    * HarperCollins e-books.
    *
    * There is normally no publication place.
    */
    if (format === 'APA') {

      /*
      * The title has already been extracted,
      * so use its position as the boundary
      * between title and publisher.
      */
      if (title) {
        const titleIndex = cleaned.indexOf(title);

        if (titleIndex >= 0) {
          let remainder = cleaned
            .slice(titleIndex + title.length)
            .trim();

          /*
          * Remove punctuation separating the
          * title from the publisher.
          */
          remainder = remainder
            .replace(/^[.\s]+/, '')
            .replace(/\.$/, '')
            .trim();

          if (remainder) {
            return remainder;
          }
        }
      }

      /*
      * Fallback for standard APA book form:
      *
      * Author. (2007). Title. Publisher.
      */
      const apaMatch = cleaned.match(
        /\(\d{4}\)\.\s+.+?\.\s+(.+?)\.?$/u
      );

      if (apaMatch) {
        return apaMatch[1]
          .trim()
          .replace(/\.$/, '');
      }
    }


    /*
    * MLA:
    *
    * Dillard, Annie. The Writing Life.
    * HarperCollins e-books, 2007.
    */
    if (format === 'MLA') {

      /*
      * Prefer using the already-extracted title.
      */
      if (title) {
        const titleIndex = cleaned.indexOf(title);

        if (titleIndex >= 0) {
          let remainder = cleaned
            .slice(titleIndex + title.length)
            .trim();

          remainder = remainder
            .replace(/^[.\s]+/, '')
            .replace(/,\s*[12]\d{3}\.?\s*$/, '')
            .trim();

          if (remainder) {
            return remainder;
          }
        }
      }

      /*
      * Fallback:
      *
      * Publisher, 2007.
      */
      const mlaMatch = cleaned.match(
        /\.\s+([^,]+),\s*[12]\d{3}\.?\s*$/u
      );

      if (mlaMatch) {
        return mlaMatch[1].trim();
      }
    }


    /*
    * Generic fallback:
    *
    * This preserves some usefulness for citations
    * whose style could not be positively identified.
    */
    if (title) {
      const titleIndex = cleaned.indexOf(title);

      if (titleIndex >= 0) {
        const remainder = cleaned
          .slice(titleIndex + title.length)
          .trim();

        // Try Place: Publisher.
        const placePublisherMatch = remainder.match(
          /(?:^|\.\s+)([^:]+):\s+(.+?)\.?$/u
        );

        if (placePublisherMatch) {
          return placePublisherMatch[2]
            .trim()
            .replace(/\.$/, '');
        }
      }
    }

    return '';
  }

  private extractPublicationPlace(
    raw: string,
    format: string
  ): string {

    const cleaned = this.stripTrailingCallNumber(
      this.cleanWhitespace(raw)
    );

    // Preserve your older/legal citation format.
    const pubBlock = this.getPublicationBlock(cleaned);

    if (pubBlock) {
      const match =
        pubBlock.parenContent.match(/^([^:]+):/u);

      return match ? match[1].trim() : '';
    }

    if (format === 'Chicago') {
      const authorDateSplit =
        this.splitAuthorDateCitation(cleaned);

      if (authorDateSplit) {
        const pubMatch = authorDateSplit.rest.match(
          /\.\s+([^:]+):\s+(.+?)\.?$/u
        );

        if (pubMatch) {
          return pubMatch[1].trim();
        }
      }
    }

    if (format === 'Harvard') {
      const match = cleaned.match(
        /\.\s+([^:]+):\s+(.+?)\.?$/u
      );

      if (match) {
        return match[1].trim();
      }
    }

    // APA 7 and MLA don't normally include publication place.
    return '';
  }

  private inferType(raw: string, _title: string, _containerTitle: string): ParsedCitationType {
    const value = raw.toLowerCase();

    if (/\bdoi\b|\bvol\.?\b|\bno\.?\b|\bissue\b|\bpp?\.?\b/.test(value)) return 'article';
    if (/\bin:\s/i.test(raw)) return 'chapter';
    if (/\bdvd\b|\bfilm\b|\bstreaming\b|\bdirected by\b/.test(value)) return 'video';
    if (/https?:\/\//.test(raw)) return 'webpage';
    if (/\bpress\b|\bpublisher\b|:\s+[^.]+$|\(\s*[^)]*\d{4}\s*\)/i.test(raw)) return 'book';

    return 'unknown';
  }

  private extractVolume(raw: string): string {
    const match = raw.match(/\bvol\.?\s*([A-Za-z0-9\-]+)/i);
    return match ? match[1] : '';
  }

  private extractIssue(raw: string): string {
    const match = raw.match(/\bno\.?\s*([A-Za-z0-9\-]+)/i);
    return match ? match[1] : '';
  }

  private extractPages(raw: string): string {
    const match = raw.match(/\bpp?\.?\s*([0-9\-–]+)/i);
    return match ? match[1] : '';
  }

  private extractDoi(raw: string): string {
    const match = raw.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i);
    return match ? match[0] : '';
  }

  private extractIsbn(raw: string): string {
    const match = raw.match(/\b(?:97[89][-\s]?)?[0-9][0-9\-\s]{8,}[0-9Xx]\b/);
    return match ? match[0] : '';
  }

  private extractIssn(raw: string): string {
    const match = raw.match(/\b\d{4}-\d{3}[\dXx]\b/);
    return match ? match[0] : '';
  }

  private extractUrl(raw: string): string {
    const match = raw.match(/https?:\/\/\S+/i);
    return match ? match[0] : '';
  }

  private buildWarnings(
    raw: string,
    creators: ParsedCreator[],
    title: string,
    year: string
  ): string[] {
    const warnings: string[] = [];
    if (!creators.length) warnings.push('No creators detected');
    if (!title) warnings.push('No title detected');
    if (!year) warnings.push('No year detected');
    if (raw.length > 300) warnings.push('Long citation; review recommended');
    return warnings;
  }
}